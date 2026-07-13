import { fal } from "@fal-ai/client";
import { createTools, type ToolDef } from "./chat-tools";
import { useMovieStore } from "@/stores/movie-store";
import { useProjectStore } from "@/stores/project-store";
import { useFolderStore } from "@/stores/folder-store";

const MAX_TOOL_ROUNDS = 500;

function buildSystemPrompt(tools: ToolDef[]): string {
  const toolDescriptions = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`,
    )
    .join("\n");

  const store = useMovieStore.getState();
  const projects = useProjectStore.getState().projects;
  const activeId = useProjectStore.getState().activeProjectId;
  const folderName = useFolderStore.getState().folderName;

  const charSummary = store.characters
    .map(
      (c) =>
        `  - [${c.id}] ${c.name || "(unnamed)"}: ${c.description || "no description"} | image:${c.imageFilename ? "yes" : "no"} video:${c.videoFilename ? "yes" : "no"}`,
    )
    .join("\n");

  const sceneSummary = store.scenes
    .map((s) => {
      const taggedChars = (s.characterIds || [])
        .map((cid) => store.characters.find((c) => c.id === cid)?.name || cid)
        .join(", ");
      return `  - [${s.id}] ${s.name || "(unnamed)"}: ${s.description || "no description"} | location: ${s.location || "none"} | duration: ${s.videoDuration}s | image:${s.imageFilename ? "yes" : "no"} video:${s.videoFilename ? "yes" : "no"} | characters: ${taggedChars || "(none tagged)"} | dialogue lines: ${(s.conversations || []).length}`;
    })
    .join("\n");

  return `You are an AI Video Studio assistant. You help users create AI-generated movies by managing their story, characters, scenes, images, and videos.

You have access to tools that can read and modify the project. Use them to help the user. When you need to take action, output a tool call as a JSON block. You can call multiple tools in sequence.

## Current Project State

Workspace: ${folderName || "none"}
Projects: ${projects.map((p) => p.name).join(", ") || "none"}
Active project: ${activeId || "none"}
Art style: ${store.artStyle}${store.customArtStyle ? ` (custom: ${store.customArtStyle})` : ""}
Language: ${store.language}
Story: ${store.story || "(empty)"}

Characters:
${charSummary || "  (none)"}

Scenes:
${sceneSummary || "  (none)"}

## Available Tools

${toolDescriptions}

## How to Use Tools

When you need to use a tool, output it as a fenced JSON block:

\`\`\`tool
{"tool": "tool_name", "arguments": {...}}
\`\`\`

You can call multiple tools in one message by including multiple tool blocks. After each tool call, you will see the result and can continue.

## Guidelines

- Be concise and helpful. Default to 2-4 sentences when responding.
- When the user asks to "generate everything" or "run the pipeline", guide them step by step: first make sure they have a story, then extract characters, generate character images, extract scenes, tag characters per scene, generate scene images, generate scripts, then generate videos.
- Always check if the prerequisites are met before calling a tool (e.g., story must exist before extracting characters).
- CRITICAL: Character images MUST be generated first before generating scene images. Scene image generation references character images to maintain visual consistency. If the user asks to generate scene images, always check whether character images exist first. If not, generate character images first, then proceed to scene images.
- CRITICAL: Before generating scene images, you MUST set which characters appear in each scene. Use auto_tag_scene_characters to automatically analyze the story and tag every scene at once. Use update_scene_characters for manual adjustments. Scene image generation will only reference the characters tagged for that scene. Max 3 characters per scene.
- After extracting scenes, immediately call auto_tag_scene_characters to determine which characters appear in each scene. This is a required step before generate_scene_images.
- If a tool returns an error, explain it to the user and suggest how to fix it.
- For destructive actions (delete), always ask for confirmation before calling the tool.
- When showing character/scene IDs to the user, also show the name so they can identify them.
- If the user seems new or lost, guide them through the workflow: write a story → extract characters → generate character images → extract scenes → tag characters per scene → generate scene images → generate videos → export.`;
}

interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

async function callLLM(
  messages: LLMMessage[],
  apiKey: string,
): Promise<string> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-pro",
        messages: messages as unknown as Record<string, unknown>[],
        max_tokens: 2048,
        temperature: 0.7,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    },
  );

  const data = result.data as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

function parseToolCalls(
  content: string,
): { tool: string; arguments: Record<string, unknown> }[] {
  const calls: { tool: string; arguments: Record<string, unknown> }[] = [];
  const regex = /```tool\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, arguments: parsed.arguments || {} });
      }
    } catch {
      // skip unparseable blocks
    }
  }
  return calls;
}

function stripToolBlocks(content: string): string {
  return content.replace(/```tool\n[\s\S]*?```/g, "").trim();
}

export interface AgentResponse {
  text: string;
  toolCalls: {
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    error?: string;
  }[];
}

export async function sendChatMessage(
  userMessage: string,
  conversationHistory: { role: "user" | "agent"; content: string }[],
  apiKey: string,
): Promise<AgentResponse> {
  const tools = createTools();
  const toolMap = new Map<string, ToolDef>(tools.map((t) => [t.name, t]));

  const messages: LLMMessage[] = [
    { role: "system", content: buildSystemPrompt(tools) },
  ];

  // Add conversation history (last 20 messages to keep context manageable)
  const recentHistory = conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const allToolCalls: {
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    error?: string;
  }[] = [];

  let round = 0;
  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const responseText = await callLLM(messages, apiKey);
    const toolCalls = parseToolCalls(responseText);

    if (toolCalls.length === 0) {
      // No tool calls — this is the final response
      return { text: responseText, toolCalls: allToolCalls };
    }

    // Add the assistant's response (including tool blocks) to messages
    messages.push({ role: "assistant", content: responseText });

    // Execute each tool call
    for (const tc of toolCalls) {
      const tool = toolMap.get(tc.tool);
      if (!tool) {
        const errMsg = `Error: unknown tool "${tc.tool}". Available: ${tools.map((t) => t.name).join(", ")}.`;
        messages.push({ role: "tool", content: errMsg, tool_call_id: tc.tool });
        allToolCalls.push({
          name: tc.tool,
          arguments: tc.arguments,
          result: "",
          error: errMsg,
        });
        continue;
      }

      try {
        const result = await tool.execute(tc.arguments);
        messages.push({ role: "tool", content: result, tool_call_id: tc.tool });
        allToolCalls.push({ name: tc.tool, arguments: tc.arguments, result });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        messages.push({
          role: "tool",
          content: `Error: ${errMsg}`,
          tool_call_id: tc.tool,
        });
        allToolCalls.push({
          name: tc.tool,
          arguments: tc.arguments,
          result: "",
          error: errMsg,
        });
      }
    }

    // Rebuild system prompt with updated project state for next round
    messages[0] = { role: "system", content: buildSystemPrompt(tools) };
  }

  // Max rounds exceeded — get final summary
  messages.push({
    role: "user",
    content: "Summarize what was accomplished in a brief message.",
  });
  const finalText = await callLLM(messages, apiKey);
  return { text: finalText, toolCalls: allToolCalls };
}
