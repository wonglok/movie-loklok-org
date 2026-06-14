import { fal } from "@fal-ai/client";

import type { Character } from "@/stores/movie-store";

export const FAL_TEXT2IMG = "https://fal.run/fal-ai/nano-banana";

export async function resolveCharacterRefs(
  characters: Character[],
  folderHandle: FileSystemDirectoryHandle | null,
  apiKey: string,
): Promise<string[]> {
  fal.config({ credentials: apiKey });
  const urls: string[] = [];

  for (const char of characters) {
    if (char.sourceUrl) {
      urls.push(char.sourceUrl);
    } else if (char.imageFilename && folderHandle) {
      try {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const charDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const fileHandle = await charDir.getFileHandle(char.imageFilename);
        const file = await fileHandle.getFile();
        const uploadedUrl = await fal.storage.upload(file);
        urls.push(uploadedUrl);
      } catch {
        // skip if upload fails
      }
    }
  }

  return urls;
}

export interface GenerateResult {
  url: string;
  prompt: string;
}

export async function generateImage(
  prompt: string,
  apiKey: string,
): Promise<GenerateResult> {
  const res = await fetch(FAL_TEXT2IMG, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      image_size: "landscape_4_3",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal.ai error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { url: data.images[0].url, prompt };
}

export async function generateSceneImage(
  prompt: string,
  apiKey: string,
  imageUrls: string[],
): Promise<GenerateResult> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt,
      num_images: 1,
      aspect_ratio: "auto",
      output_format: "png",
      safety_tolerance: "4",
      image_urls: imageUrls,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  const data = result.data as { images: { url: string }[] };
  return { url: data.images[0].url, prompt };
}

export async function extractCharacters(
  story: string,
  apiKey: string,
  language?: string,
): Promise<{ name: string; description: string }[]> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content: `Extract all characters from this movie story. Return ONLY a valid JSON array of objects with "name" and "description" fields. The description is about the character's personality. No other text.${language ? `\n\nWrite all output in ${language}.` : ""}\n\nStory: ${story}`,
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json);
}

export async function extractVideoInfo(
  story: string,
  apiKey: string,
): Promise<{
  title: string;
  genre: string;
  duration: string;
  format: string;
  resolution: string;
  framerate: string;
  description: string;
}> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content: `Extract video production metadata from this movie story. Return ONLY a valid JSON object with these fields: "title" (a compelling movie title), "genre" (e.g. Sci-Fi, Drama, Action), "duration" (estimated runtime like "120 minutes"), "format" (e.g. 2.39:1 widescreen, 1.85:1 flat), "resolution" (e.g. 4K, 1080p), "framerate" (e.g. 24fps), "description" (a one-line logline). No other text.\n\nStory: ${story}`,
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json);
}

const FAL_VIDEO = "bytedance/seedance-2.0/fast/reference-to-video";

// export async function generateVideo(
//   imageUrl: string,
//   prompt: string,
//   apiKey: string,
// ): Promise<string> {
//   fal.config({ credentials: apiKey });

//   const result = await fal.subscribe(FAL_VIDEO, {
//     input: {
//       prompt,
//       image_urls: [imageUrl],
//       aspect_ratio: "9:16",
//       resolution: "720p",
//       enable_safety_checker: false,
//     },
//     logs: true,
//     onQueueUpdate: (update) => {
//       if (update.status === "IN_PROGRESS") {
//         update.logs.map((log) => log.message).forEach(console.log);
//       }
//     },
//   });

//   const data = result.data as { video?: { url: string }; url?: string };
//   return data.video?.url ?? data.url ?? "";
// }

export async function uploadAndGenerateVideo(
  file: File,
  prompt: string,
  apiKey: string,
  resolution?: string,
  aspectRatio?: string,
  videoFiles?: File[],
): Promise<string> {
  fal.config({ credentials: apiKey });
  const fileUrl = await fal.storage.upload(file);

  const videoUrls: string[] = [];
  if (videoFiles?.length) {
    for (const vf of videoFiles) {
      videoUrls.push(await fal.storage.upload(vf));
    }
  }

  const result = await fal.subscribe(FAL_VIDEO, {
    input: {
      prompt,
      image_urls: [fileUrl],
      aspect_ratio: aspectRatio ?? "9:16",
      resolution: resolution ?? "480p",
      duration: "auto",
      generate_audio: true,
      video_urls: videoUrls,
      audio_urls: [],
    },
    logs: true,
    onQueueUpdate: async (update) => {
      console.log("update", update);
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  const data = result.data as { video?: { url: string }; url?: string };
  return data.video?.url ?? data.url ?? "";
}

export async function extractMoments(
  story: string,
  scenes: { id: string; name: string; description: string }[],
  apiKey: string,
): Promise<
  {
    id: string;
    sceneId: string;
    name: string;
    description: string;
    duration: number;
    cameraAngle: string;
    cameraMovement: string;
  }[]
> {
  fal.config({ credentials: apiKey });

  const scenesContext = scenes
    .map((s, i) => `Scene ${i}: ${s.name} - ${s.description}`)
    .join("\n");

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content: `Extract key moments/shots from each scene of this movie story. Return ONLY a valid JSON array of objects with these fields: "sceneIndex" (number matching the scene number below), "name" (shot name), "description" (what happens in this moment), "duration" (shot length in seconds, a number like 5), "cameraAngle" (e.g. "Eye level", "Low angle", "High angle", "Dutch angle", "Overhead"), "cameraMovement" (e.g. "Static", "Slow pan", "Dolly in", "Tracking shot", "Handheld"). No other text.\n\nStory: ${story}\n\nScenes:\n${scenesContext}`,
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  const raw = JSON.parse(json) as {
    sceneIndex: number;
    name: string;
    description: string;
    duration: number;
    cameraAngle: string;
    cameraMovement: string;
  }[];
  return raw.map((m) => ({
    id: crypto.randomUUID(),
    sceneId: scenes[m.sceneIndex]?.id ?? "",
    name: m.name,
    description: m.description,
    duration: m.duration,
    cameraAngle: m.cameraAngle,
    cameraMovement: m.cameraMovement,
  }));
}

export async function extractScenes(
  story: string,
  apiKey: string,
  language?: string,
): Promise<
  {
    name: string;
    description: string;
    conversations: {
      id: string;
      person: string;
      line: string;
      camera: string;
    }[];
  }[]
> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content: `Extract all key scenes from this movie story. Return ONLY a valid JSON array of objects with these fields:
- "name": scene name
- "description": scene description
- "conversations": an array of objects, each with "person" (the character speaking or voice-over narrator), "line" (their line of dialogue or narration), and "camera" (camera direction for this shot, e.g. "Static", "Close up", "Slow pan", "Dolly in", "Wide"). Each scene is max 15 seconds, so keep dialogue concise and brief. If no one speaks, use an empty array.

No other text.${language ? `\n\nWrite all output in ${language}.` : ""}\n\nStory: ${story}`,
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  const raw = JSON.parse(json) as {
    name: string;
    description: string;
    conversations: { person: string; line: string; camera?: string }[];
  }[];
  return raw.map((s) => ({
    ...s,
    conversations: (s.conversations || []).map((c) => ({
      id: crypto.randomUUID(),
      person: c.person,
      line: c.line,
      camera: c.camera || "Static",
    })),
  }));
}

export async function regenerateSceneConversations(
  sceneName: string,
  sceneDescription: string,
  apiKey: string,
  language?: string,
): Promise<{ id: string; person: string; line: string; camera: string }[]> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content: `
Write the scripted dialogue for this scene from a movie story. The scene has a maximum duration of 15 seconds, so keep the total dialogue concise — each line should be brief and speakable within that timeframe. Return ONLY a valid JSON array of objects, each with "person" (the character speaking or voice-over narrator), "line" (their line of dialogue or narration), and "camera" (camera direction for this shot, e.g. "Static", "Close up", "Slow pan", "Dolly in", "Wide", "Over shoulder"). Include all dialogue that happens in this scene. If no one speaks, return an empty array. No other text.

Scene: ${sceneName}
Description: ${sceneDescription}
${language ? `\nWrite all output in ${language}.` : ""}`.trim(),
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  const raw = JSON.parse(json) as {
    person: string;
    line: string;
    camera?: string;
  }[];
  return raw.map((c) => ({
    id: crypto.randomUUID(),
    person: c.person,
    line: c.line,
    camera: c.camera || "Static",
  }));
}

export async function estimateSceneMetadata(
  sceneName: string,
  sceneDescription: string,
  conversations: { person: string; line: string }[],
  apiKey: string,
): Promise<{ videoDuration: number }> {
  fal.config({ credentials: apiKey });

  const dialogueSummary = conversations
    .map((c) => `${c.person}: "${c.line}"`)
    .join("\n");

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "google/gemma-4-26b-a4b-it",
        messages: [
          {
            role: "user",
            content:
              `Estimate the total duration for this movie scene based on its dialogue and description. Return ONLY a valid JSON object with:
- "videoDuration": estimated total length in seconds (a number between 3 and 15, max 15 seconds, based on dialogue pacing and number of lines). Add 1-2 seconds to the estimated duration by default so the video won't cut off abruptly.

Consider the mood, action, and pacing implied by the dialogue.

Scene: ${sceneName}
Description: ${sceneDescription}

Dialogue:
${dialogueSummary || "(no dialogue)"}`.trim(),
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  const metadata = JSON.parse(json) as { videoDuration: number };
  return {
    videoDuration: Math.min(Math.max(1, metadata.videoDuration), 15),
  };
}

export async function regenerateSceneDescription(
  story: string,
  sceneName: string,
  sceneDescription: string,
  conversations: { person: string; line: string }[],
  apiKey: string,
  language?: string,
): Promise<{ name: string; description: string }> {
  fal.config({ credentials: apiKey });

  const dialogueSummary = conversations
    .map((c) => `${c.person}: "${c.line}"`)
    .join("\n");

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "user",
            content:
              `Rewrite the name and description for this movie scene based on its dialogue and the full story context. Return ONLY a valid JSON object with "name" (a compelling scene title) and "description" (a concise scene description). No other text.${language ? `\n\nWrite all output in ${language}.` : ""}

Full story: ${story}

Current scene name: ${sceneName}
Current scene description: ${sceneDescription}

Dialogue:
${dialogueSummary || "(no dialogue)"}`.trim(),
          },
        ],
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
  const text = data.choices[0].message.content;
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json);
}
