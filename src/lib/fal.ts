import { fal } from "@fal-ai/client";

export const FAL_TEXT2IMG = "https://fal.run/fal-ai/nano-banana";

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

export async function extractCharacters(
  story: string,
  apiKey: string,
): Promise<{ name: string; description: string }[]> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Extract all characters from this movie story. Return ONLY a valid JSON array of objects with "name" and "description" fields. No other text.\n\nStory: ${story}`,
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
        model: "openai/gpt-4o-mini",
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

const FAL_VIDEO = "fal-ai/happy-horse/reference-to-video";

export async function generateVideo(
  imageUrl: string,
  prompt: string,
  apiKey: string,
): Promise<string> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(FAL_VIDEO, {
    input: {
      prompt,
      image_url: imageUrl,
      aspect_ratio: "9:16",
      resolution: "720p",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  const data = result.data as { video?: { url: string }; url?: string };
  return data.video?.url ?? data.url ?? "";
}

export async function uploadAndGenerateVideo(
  file: File,
  prompt: string,
  apiKey: string,
): Promise<string> {
  fal.config({ credentials: apiKey });
  const fileUrl = await fal.storage.upload(file);
  return generateVideo(fileUrl, prompt, apiKey);
}

export async function extractScenes(
  story: string,
  apiKey: string,
): Promise<{ name: string; description: string }[]> {
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe(
    "openrouter/router/openai/v1/chat/completions",
    {
      input: {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Extract all key scenes and locations from this movie story. Return ONLY a valid JSON array of objects with "name" and "description" fields. Include establishing shots, key locations, and pivotal scene settings. No other text.\n\nStory: ${story}`,
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
