import { fal } from "@fal-ai/client";

import type { Character } from "@/stores/movie-store";

export const FAL_TEXT2IMG = "https://fal.run/fal-ai/nano-banana";

export async function resolveCharacterRefs(
  characters: Character[],
  folderHandle: FileSystemDirectoryHandle | null,
  apiKey: string,
  projectId?: string,
): Promise<string[]> {
  fal.config({ credentials: apiKey });
  const urls: string[] = [];

  for (const char of characters) {
    if (!char.imageFilename || !folderHandle || !projectId) continue;
    try {
      const projectsDir = await folderHandle.getDirectoryHandle("projects", {
        create: true,
      });
      const projectDir = await projectsDir.getDirectoryHandle(projectId, {
        create: true,
      });
      const imagesDir = await projectDir.getDirectoryHandle("images", {
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
        model: "deepseek/deepseek-v4-pro",
        messages: [
          {
            role: "user",
            content: `Extract all characters from this movie story. Return ONLY a valid JSON array of objects with "name" and "description" fields. The description is about the character's face description, outlook description, and voice description. No other text. ${language ? `\n\nWrite all output in ${language}.` : ""}\n\nStory: ${story}`,
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
        model: "deepseek/deepseek-v4-pro",
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

const FAL_VIDEO = "bytedance/seedance-2.0/mini/reference-to-video";

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

// export async function extractMoments(
//   story: string,
//   scenes: { id: string; name: string; description: string }[],
//   apiKey: string,
// ): Promise<
//   {
//     id: string;
//     sceneId: string;
//     name: string;
//     description: string;
//     duration: number;
//     cameraAngle: string;
//     cameraMovement: string;
//   }[]
// > {
//   fal.config({ credentials: apiKey });

//   const scenesContext = scenes
//     .map((s, i) => `Scene ${i}: ${s.name} - ${s.description}`)
//     .join("\n");

//   const result = await fal.subscribe(
//     "openrouter/router/openai/v1/chat/completions",
//     {
//       input: {
//         model: "deepseek/deepseek-v4-pro",
//         messages: [
//           {
//             role: "user",
//             content: `Extract key moments/shots from each scene of this movie story. Return ONLY a valid JSON array of objects with these fields: "sceneIndex" (number matching the scene number below), "name" (shot name), "description" (what happens in this moment), "duration" (shot length in seconds, a number like 5), "cameraAngle" (e.g. "Eye level", "Low angle", "High angle", "Dutch angle", "Overhead"), "cameraMovement" (e.g. "Static", "Slow pan", "Dolly in", "Tracking shot", "Handheld"). No other text.\n\nStory: ${story}\n\nScenes:\n${scenesContext}`,
//           },
//         ],
//       },
//       logs: true,
//       onQueueUpdate: (update) => {
//         if (update.status === "IN_PROGRESS") {
//           update.logs.map((log) => log.message).forEach(console.log);
//         }
//       },
//     },
//   );

//   const data = result.data as {
//     choices: { message: { content: string } }[];
//   };
//   const text = data.choices[0].message.content;
//   const json = text.replace(/```json|```/g, "").trim();
//   const raw = JSON.parse(json) as {
//     sceneIndex: number;
//     name: string;
//     description: string;
//     duration: number;
//     cameraAngle: string;
//     cameraMovement: string;
//   }[];
//   return raw.map((m) => ({
//     id: crypto.randomUUID(),
//     sceneId: scenes[m.sceneIndex]?.id ?? "",
//     name: m.name,
//     description: m.description,
//     duration: m.duration,
//     cameraAngle: m.cameraAngle,
//     cameraMovement: m.cameraMovement,
//   }));
// }

export async function extractScenes(
  story: string,
  apiKey: string,
  language?: string,
  characters?: { id: string; name: string; description: string }[],
): Promise<
  {
    name: string;
    description: string;
    location: string;
    characterIds: string[];
    conversations: {
      id: string;
      person: string;
      line: string;
    }[];
  }[]
> {
  //

  fal.config({ credentials: apiKey });

  const charList = characters?.length
    ? `\n\nCharacters:\n${characters.map((c) => `- id="${c.id}" name="${c.name}" description="${c.description}"`).join("\n")}`
    : "";

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-pro",
        messages: [
          {
            role: "user",
            content: `Extract all key scenes from this movie story. Return ONLY a valid JSON array of objects with these fields:
- "name": scene name
- "description": scene description
- "location": a brief description of where this scene takes place (e.g. "A dimly lit detective's office", "A bustling city street at noon", "A quiet forest clearing")
- "characterIds": an array of character IDs (from the character list below) that appear in this scene. Use the exact IDs provided. Include at least 1 character per scene, max 3. Pick the most relevant characters based on the scene description.
- "conversations": an array of objects, each with "person" (the character speaking or voice-over narrator) and "line" (their line of dialogue or narration). Each scene is max 13.5 seconds, so keep dialogue concise. If no one speaks, use an empty array.

No other text.${language ? `\n\n Must Write all output in ${language}.` : ""}${charList}\n\nStory: ${story}`,
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
    location: string;
    characterIds?: string[];
    conversations: { person: string; line: string }[];
  }[];
  return raw.map((s) => ({
    ...s,
    location: s.location || "",
    characterIds: s.characterIds || [],
    conversations: (s.conversations || []).map((c) => ({
      id: crypto.randomUUID(),
      person: c.person,
      line: c.line,
    })),
  }));
}

export async function regenerateSceneConversations(
  sceneName: string,
  sceneDescription: string,
  apiKey: string,
  language?: string,
): Promise<{ id: string; person: string; line: string }[]> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "deepseek/deepseek-v4-pro",
        messages: [
          {
            role: "user",
            content: `
Write the scripted dialogue for this scene from a movie story. The scene has a maximum duration of 12 seconds, so keep the total dialogue concise — each line should be brief and speakable within that timeframe. Return ONLY a valid JSON array of objects, each with "person" (the character speaking or voice-over narrator) and "line" (their line of dialogue or narration). Include all dialogue that happens in this scene. If no one speaks, return an empty array. No other text.

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
  }[];
  return raw.map((c) => ({
    id: crypto.randomUUID(),
    person: c.person,
    line: c.line,
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
- "videoDuration": estimated total length in seconds (a number between 3 and 12, max 12 seconds, based on dialogue pacing and number of lines). Add 1-2 seconds to the estimated duration by default so the video won't cut off abruptly.

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
    videoDuration: Math.min(Math.max(1, metadata.videoDuration), 12),
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
        model: "deepseek/deepseek-v4-pro",
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

export async function regenerateSceneLocation(
  sceneName: string,
  sceneDescription: string,
  apiKey: string,
  language?: string,
): Promise<string> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "google/gemma-4-26b-a4b-it",
        messages: [
          {
            role: "user",
            content: `Describe the location where this movie scene takes place. Return ONLY a short location description (e.g. "A dimly lit detective's office", "A bustling city street at noon", "A quiet forest clearing"). Keep it under 15 words. No other text.${language ? `\n\nWrite in ${language}.` : ""}

Scene: ${sceneName}
Description: ${sceneDescription}`,
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
  return data.choices[0].message.content.trim();
}

export async function tagSceneCharacters(
  story: string,
  characters: { id: string; name: string; description: string }[],
  scenes: { id: string; name: string; description: string }[],
  apiKey: string,
): Promise<Record<string, string[]>> {
  fal.config({ credentials: apiKey });

  const charList = characters
    .map(
      (c, i) =>
        `${i}: id="${c.id}" name="${c.name}" description="${c.description}"`,
    )
    .join("\n");

  const sceneList = scenes
    .map(
      (s, i) =>
        `${i}: id="${s.id}" name="${s.name}" description="${s.description}"`,
    )
    .join("\n");

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "google/gemma-4-26b-a4b-it",
        messages: [
          {
            role: "user",
            content: `Given a movie story and its characters and scenes, determine which characters appear in each scene. For each scene, return the character IDs of characters that are present (at least 1, max 3 per scene). EVERY scene MUST have at least one character — if a character is mentioned by name or clearly involved in the scene description, include them. If no character is explicitly mentioned, pick the character that makes the most narrative sense for that scene.

Return ONLY a valid JSON object mapping EVERY scene ID to an array of character IDs. Example: {"scene-id-1": ["char-id-1", "char-id-2"], "scene-id-2": ["char-id-3"]}. No other text.

Story:
${story}

Characters:
${charList}

Scenes:
${sceneList}`,
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
  const raw = JSON.parse(json) as Record<string, string[]>;

  // Validate and cap at 3 characters per scene
  const validCharIds = new Set(characters.map((c) => c.id));
  const fallbackId = characters[0]?.id ?? null;
  const out: Record<string, string[]> = {};

  for (const scene of scenes) {
    const charIds = (raw[scene.id] || [])
      .filter((id) => validCharIds.has(id))
      .slice(0, 3);
    // Ensure at least 1 character per scene — fall back to the first character
    out[scene.id] =
      charIds.length > 0 ? charIds : fallbackId ? [fallbackId] : [];
  }
  return out;
}
