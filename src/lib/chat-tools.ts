import { useMovieStore, ART_STYLES, type ArtStyle } from "@/stores/movie-store";
import { useProjectStore } from "@/stores/project-store";
import { useFolderStore } from "@/stores/folder-store";
import {
  extractCharacters,
  extractScenes,
  generateImage,
  generateSceneImage,
  resolveCharacterRefs,
  uploadAndGenerateVideo,
  regenerateSceneConversations,
  estimateSceneMetadata,
  tagSceneCharacters,
} from "@/lib/fal";
import { resolveStyle } from "@/lib/style";
import {
  getProjectImagesDir,
  getProjectClipsDir,
  saveAndLoadLocal,
  savePromptFile,
  readCharactersJson,
  readScenesJson,
  exportProjectAsZip,
  archiveFile,
} from "@/lib/fs-helpers";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

function getApiKey(): string | null {
  return useFolderStore.getState().apiKey;
}

function getFolderHandle(): FileSystemDirectoryHandle | null {
  return useFolderStore.getState().folderHandle;
}

function getProjectId(): string | null {
  return useMovieStore.getState().projectId;
}

function projectContext(): string {
  const s = useMovieStore.getState();
  const projects = useProjectStore.getState().projects;
  const activeId = useProjectStore.getState().activeProjectId;
  const folderName = useFolderStore.getState().folderName;

  const charSummary = s.characters
    .map(
      (c) =>
        `- ${c.name || "(unnamed)"}: ${c.description || "no description"} [image: ${c.imageFilename ? "yes" : "no"}, video: ${c.videoFilename ? "yes" : "no"}]`,
    )
    .join("\n");

  const sceneSummary = s.scenes
    .map(
      (sc) =>
        `- ${sc.name || "(unnamed)"}: ${sc.description || "no description"} [image: ${sc.imageFilename ? "yes" : "no"}, video: ${sc.videoFilename ? "yes" : "no"}, conversations: ${sc.conversations?.length || 0}]`,
    )
    .join("\n");

  return `Workspace: ${folderName || "none"}
Projects (${projects.length}): ${projects.map((p) => p.name).join(", ") || "none"}
Active project: ${activeId || "none"}
Art style: ${s.artStyle}${s.customArtStyle ? ` (custom: ${s.customArtStyle})` : ""}
Language: ${s.language}
Story: ${s.story || "(empty)"}
Characters (${s.characters.length}):
${charSummary || "(none)"}
Scenes (${s.scenes.length}):
${sceneSummary || "(none)"}`;
}

export function createTools(): ToolDef[] {
  return [
    {
      name: "get_project_status",
      description:
        "Get a summary of the current project: story, characters, scenes, what's been generated.",
      parameters: {},
      execute: async () => projectContext(),
    },

    {
      name: "update_story",
      description: "Set or append to the movie story text.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The story text to set." },
        },
        required: ["text"],
      },
      execute: async (args) => {
        const text = args.text as string;
        useMovieStore.getState().setStory(text);
        return `Story updated (${text.length} characters).`;
      },
    },

    {
      name: "set_art_style",
      description: "Change the visual art style for the movie.",
      parameters: {
        type: "object",
        properties: {
          style: {
            type: "string",
            enum: ART_STYLES.map((s) => s.key),
            description: "The art style key.",
          },
        },
        required: ["style"],
      },
      execute: async (args) => {
        const style = args.style as string;
        if (!ART_STYLES.some((s) => s.key === style)) {
          return `Error: "${style}" is not a valid style. Options: ${ART_STYLES.map((s) => s.key).join(", ")}.`;
        }
        useMovieStore.getState().setArtStyle(style as ArtStyle);
        return `Art style set to ${style}.`;
      },
    },

    {
      name: "set_language",
      description: "Set the language for all generated content.",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description: "The language, e.g. English, Japanese, French.",
          },
        },
        required: ["language"],
      },
      execute: async (args) => {
        const lang = args.language as string;
        useMovieStore.getState().setLanguage(lang);
        return `Language set to ${lang}.`;
      },
    },

    {
      name: "list_characters",
      description:
        "List all characters in the current project with their details.",
      parameters: {},
      execute: async () => {
        const chars = useMovieStore.getState().characters;
        if (!chars.length) return "No characters yet.";
        return chars
          .map(
            (c) =>
              `ID: ${c.id}\n  Name: ${c.name || "(unnamed)"}\n  Description: ${c.description || "none"}\n  Location: ${c.location || "none"}\n  Has image: ${c.imageFilename ? "yes" : "no"}\n  Has video: ${c.videoFilename ? "yes" : "no"}`,
          )
          .join("\n\n");
      },
    },

    {
      name: "update_character",
      description: "Update a character's name, description, or location.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The character ID." },
          name: { type: "string", description: "New name for the character." },
          description: { type: "string", description: "New description." },
          location: { type: "string", description: "New location." },
        },
        required: ["id"],
      },
      execute: async (args) => {
        const id = args.id as string;
        const name = args.name as string | undefined;
        const description = args.description as string | undefined;
        const location = args.location as string | undefined;
        const store = useMovieStore.getState();
        const char = store.characters.find((c) => c.id === id);
        if (!char) return `Error: character with ID "${id}" not found.`;
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        store.updateCharacter(id, updates);
        return `Updated character "${updates.name || char.name}".`;
      },
    },

    {
      name: "create_character",
      description: "Add a new character to the project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Character name." },
          description: {
            type: "string",
            description:
              "Character description (appearance, personality, voice).",
          },
          location: {
            type: "string",
            description: "Where the character is usually found.",
          },
        },
        required: ["name", "description"],
      },
      execute: async (args) => {
        const store = useMovieStore.getState();
        const newChar = {
          id: crypto.randomUUID(),
          name: (args.name as string) || "",
          description: (args.description as string) || "",
          location: (args.location as string) || "",
          imageUrl: null,
          imageFilename: null,
          videoUrl: null,
          videoFilename: null,
          videoDuration: 5,
          videoResolution: "480p" as const,
          videoAspect: "9:16" as const,
          videoReferenceIds: [],
          characterIds: [],
          conversations: [],
        };
        store.setCharacters([...store.characters, newChar]);
        return `Created character "${newChar.name}" with ID: ${newChar.id}.`;
      },
    },

    {
      name: "delete_character",
      description:
        "Remove a character from the project. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The character ID to delete." },
          confirm: {
            type: "boolean",
            description: "Must be true to confirm deletion.",
          },
        },
        required: ["id", "confirm"],
      },
      execute: async (args) => {
        if (!args.confirm) return "Set confirm: true to proceed with deletion.";
        const store = useMovieStore.getState();
        const char = store.characters.find((c) => c.id === args.id);
        if (!char) return `Error: character with ID "${args.id}" not found.`;
        store.setCharacters(store.characters.filter((c) => c.id !== args.id));
        return `Deleted character "${char.name}".`;
      },
    },

    {
      name: "list_scenes",
      description:
        "List all scenes with their descriptions, locations, and dialogue.",
      parameters: {},
      execute: async () => {
        const scenes = useMovieStore.getState().scenes;
        if (!scenes.length) return "No scenes yet.";
        return scenes
          .map((s) => {
            const dialogue = (s.conversations || [])
              .map((c) => `    ${c.person}: "${c.line}"`)
              .join("\n");
            return `ID: ${s.id}\n  Name: ${s.name || "(unnamed)"}\n  Description: ${s.description || "none"}\n  Location: ${s.location || "none"}\n  Duration: ${s.videoDuration}s\n  Has image: ${s.imageFilename ? "yes" : "no"}\n  Has video: ${s.videoFilename ? "yes" : "no"}\n  Dialogue:\n${dialogue || "    (none)"}`;
          })
          .join("\n\n");
      },
    },

    {
      name: "update_scene",
      description: "Update a scene's name, description, or location.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The scene ID." },
          name: { type: "string", description: "New scene name." },
          description: {
            type: "string",
            description: "New scene description.",
          },
          location: {
            type: "string",
            description: "New location description.",
          },
        },
        required: ["id"],
      },
      execute: async (args) => {
        const id = args.id as string;
        const name = args.name as string | undefined;
        const description = args.description as string | undefined;
        const location = args.location as string | undefined;
        const store = useMovieStore.getState();
        const scene = store.scenes.find((s) => s.id === id);
        if (!scene) return `Error: scene with ID "${id}" not found.`;
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        store.updateScene(id, updates);
        return `Updated scene "${updates.name || scene.name}".`;
      },
    },

    {
      name: "create_scene",
      description: "Add a new scene to the project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Scene name." },
          description: { type: "string", description: "Scene description." },
          location: {
            type: "string",
            description: "Where the scene takes place.",
          },
        },
        required: ["name", "description"],
      },
      execute: async (args) => {
        const store = useMovieStore.getState();
        const newScene = {
          id: crypto.randomUUID(),
          name: (args.name as string) || "",
          description: (args.description as string) || "",
          location: (args.location as string) || "",
          imageUrl: null,
          imageFilename: null,
          videoUrl: null,
          videoFilename: null,
          videoDuration: 5,
          videoResolution: "480p" as const,
          videoAspect: "9:16" as const,
          videoReferenceIds: [],
          characterIds: [],
          conversations: [],
        };
        store.setScenes([...store.scenes, newScene]);
        return `Created scene "${newScene.name}" with ID: ${newScene.id}.`;
      },
    },

    {
      name: "delete_scene",
      description: "Remove a scene. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The scene ID." },
          confirm: { type: "boolean", description: "Must be true to confirm." },
        },
        required: ["id", "confirm"],
      },
      execute: async (args) => {
        if (!args.confirm) return "Set confirm: true to proceed with deletion.";
        const store = useMovieStore.getState();
        const scene = store.scenes.find((s) => s.id === args.id);
        if (!scene) return `Error: scene with ID "${args.id}" not found.`;
        store.setScenes(store.scenes.filter((s) => s.id !== args.id));
        return `Deleted scene "${scene.name}".`;
      },
    },

    {
      name: "extract_characters",
      description: "Use AI to extract characters from the story text.",
      parameters: {},
      execute: async () => {
        const store = useMovieStore.getState();
        const apiKey = getApiKey();
        if (!apiKey)
          return "Error: No API key configured. Ask the user to set their fal.ai API key in Settings.";
        if (!store.story.trim())
          return "Error: Story is empty. Write a story first.";
        const extracted = await extractCharacters(
          store.story,
          apiKey,
          store.language,
        );
        const newChars = extracted.map((c) => ({
          id: crypto.randomUUID(),
          ...c,
          location: "",
          imageUrl: null as string | null,
          imageFilename: null as string | null,
          videoUrl: null as string | null,
          videoFilename: null as string | null,
          videoDuration: 5,
          videoResolution: "480p" as const,
          videoAspect: "9:16" as const,
          videoReferenceIds: [] as string[],
          characterIds: [] as string[],
          conversations: [],
        }));
        store.setCharacters([...store.characters, ...newChars]);
        return `Extracted ${newChars.length} characters: ${newChars.map((c) => c.name).join(", ")}.`;
      },
    },

    {
      name: "extract_scenes",
      description: "Use AI to extract scenes from the story text.",
      parameters: {},
      execute: async () => {
        const store = useMovieStore.getState();
        const apiKey = getApiKey();
        if (!apiKey) return "Error: No API key configured.";
        if (!store.story.trim()) return "Error: Story is empty.";
        const extracted = await extractScenes(
          store.story,
          apiKey,
          store.language,
          store.characters.map((c) => ({ id: c.id, name: c.name, description: c.description })),
        );
        const newScenes = extracted.map((s) => ({
          id: crypto.randomUUID(),
          ...s,
          imageUrl: null as string | null,
          imageFilename: null as string | null,
          videoUrl: null as string | null,
          videoFilename: null as string | null,
          videoDuration: 5,
          videoResolution: "480p" as const,
          videoAspect: "9:16" as const,
          videoReferenceIds: [] as string[],
          characterIds: s.characterIds || [],
        }));
        store.setScenes(newScenes);
        return `Extracted ${newScenes.length} scenes: ${newScenes.map((s) => s.name).join(", ")}.`;
      },
    },

    {
      name: "generate_character_images",
      description:
        "Generate AI images for all characters that don't have one yet.",
      parameters: {},
      execute: async () => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        // Reload latest character data from disk so we use the freshest names/descriptions
        let latestChars = store.characters;
        try {
          const fromDisk = await readCharactersJson(folderHandle, projectId);
          if (fromDisk) latestChars = fromDisk;
        } catch {
          // fall back to in-memory characters if disk read fails
        }

        const chars = latestChars.filter((c) => !c.imageFilename);
        if (!chars.length) return "All characters already have images.";

        const effectiveStyle = resolveStyle(
          store.customArtStyle,
          store.artStyle,
        );
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const charDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const archiveDir = await imagesDir.getDirectoryHandle("_archive", { create: true });

        let done = 0;
        const results: string[] = [];
        for (const char of chars) {
          // Archive old image if this character already has one
          if (char.imageFilename) {
            await archiveFile(char.imageFilename, charDir, archiveDir);
            await archiveFile(char.imageFilename.replace(/\.png$/, ".txt"), charDir, archiveDir);
          }
          const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. Close-up portrait zoomed in on the character's face, single front-facing view only, no multiple views, no turnaround. Neutral facial expression. Grey background.`;
          const result = await generateImage(prompt, apiKey);
          const imageId = crypto.randomUUID();
          const filename = `${imageId}.png`;
          const localUrl = await saveAndLoadLocal(
            result.url,
            filename,
            charDir,
          );
          store.updateCharacter(char.id, {
            imageUrl: localUrl,
            imageFilename: filename,
          });
          await savePromptFile(result.prompt, `${imageId}.txt`, charDir);
          done++;
          results.push(`${char.name}: done`);
        }
        // Sync the characterImages array used by the UI
        const updated = useMovieStore.getState().characters;
        store.setCharacterImages(
          updated.map((c) => c.imageUrl).filter(Boolean) as string[],
        );
        return `Generated images for ${done} character(s):\n${results.join("\n")}`;
      },
    },

    {
      name: "generate_character_image",
      description:
        "Generate or regenerate the AI image for a single specific character. Use this to create a portrait image for one character, whether they have an existing image or not.",
      parameters: {
        type: "object",
        properties: {
          character_id: {
            type: "string",
            description: "The ID of the character to regenerate the image for.",
          },
        },
        required: ["character_id"],
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        // Reload latest character data from disk so we use the freshest name/description
        let latestChars = store.characters;
        try {
          const fromDisk = await readCharactersJson(folderHandle, projectId);
          if (fromDisk) latestChars = fromDisk;
        } catch {
          // fall back to in-memory characters if disk read fails
        }

        const char = latestChars.find(
          (c) => c.id === (args.character_id as string),
        );
        if (!char)
          return `Error: character with ID "${args.character_id}" not found.`;

        const effectiveStyle = resolveStyle(store.customArtStyle, store.artStyle);
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const charDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const archiveDir = await imagesDir.getDirectoryHandle("_archive", { create: true });

        // Archive old image if this character already has one
        if (char.imageFilename) {
          await archiveFile(char.imageFilename, charDir, archiveDir);
          await archiveFile(char.imageFilename.replace(/\.png$/, ".txt"), charDir, archiveDir);
        }

        const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. Close-up portrait zoomed in on the character's face, single front-facing view only, no multiple views, no turnaround. Neutral facial expression. Grey background.`;
        const result = await generateImage(prompt, apiKey);
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        const localUrl = await saveAndLoadLocal(result.url, filename, charDir);
        store.updateCharacter(char.id, {
          imageUrl: localUrl,
          imageFilename: filename,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, charDir);

        const updated = useMovieStore.getState().characters;
        store.setCharacterImages(
          updated.map((c) => c.imageUrl).filter(Boolean) as string[],
        );
        return `Generated image for character "${char.name}".`;
      },
    },

    {
      name: "generate_character_reference_video",
      description:
        "Generate a reference video for a single character. The character must already have an image. The video shows the character facing the camera introducing themselves. Use this when the user wants to create a reference video for one specific character.",
      parameters: {
        type: "object",
        properties: {
          character_id: {
            type: "string",
            description: "The ID of the character to generate a reference video for.",
          },
        },
        required: ["character_id"],
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        // Reload latest character data from disk so we use the freshest name/description
        let latestChars = store.characters;
        try {
          const fromDisk = await readCharactersJson(folderHandle, projectId);
          if (fromDisk) latestChars = fromDisk;
        } catch {
          // fall back to in-memory characters if disk read fails
        }

        const char = latestChars.find(
          (c) => c.id === (args.character_id as string),
        );
        if (!char)
          return `Error: character with ID "${args.character_id}" not found.`;
        if (!char.imageFilename)
          return `Error: character "${char.name}" has no image. Generate the character image first.`;

        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const charDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const fileHandle = await charDir.getFileHandle(char.imageFilename);
        const file = await fileHandle.getFile();

        const prompt = `Close-up portrait shot of the character facing the camera. The character says: "Hi! I'm ${char.name}!". Character's Voice Description: ${JSON.stringify(char.description)} The duration is around 3 seconds. The camera stays static, focused on the character's face with natural expression and lip-sync to the spoken words. Simple neutral background. Language & Tone: ${store.language}. No background music`;
        const remoteUrl = await uploadAndGenerateVideo(
          file,
          prompt,
          apiKey,
          "480p",
          "9:16",
        );

        const clipsDir = await getProjectClipsDir(folderHandle, projectId);
        const clipsArchiveDir = await clipsDir.getDirectoryHandle("_archive", { create: true });
        // Archive old reference video if this character already has one
        if (char.videoFilename) {
          await archiveFile(char.videoFilename, clipsDir, clipsArchiveDir);
        }
        const videoFilename = `${crypto.randomUUID()}.mp4`;
        const localUrl = await saveAndLoadLocal(
          remoteUrl,
          videoFilename,
          clipsDir,
        );
        store.updateCharacter(char.id, { videoUrl: localUrl, videoFilename });
        return `Generated reference video for character "${char.name}".`;
      },
    },

    {
      name: "generate_scene_images",
      description:
        "Generate AI images for all scenes that don't have one yet, or for specific scene IDs.",
      parameters: {
        type: "object",
        properties: {
          scene_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional list of scene IDs to generate. If omitted, generates for all scenes without images.",
          },
        },
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        // Reload latest data from disk so we use the freshest characters, scenes, and images
        let latestChars = store.characters;
        let latestScenes = store.scenes;
        try {
          const charsFromDisk = await readCharactersJson(folderHandle, projectId);
          if (charsFromDisk) latestChars = charsFromDisk;
          const scenesFromDisk = await readScenesJson(folderHandle, projectId);
          if (scenesFromDisk) latestScenes = scenesFromDisk;
        } catch {
          // fall back to in-memory data if disk read fails
        }

        const targetIds = args.scene_ids as string[] | undefined;
        let targets = latestScenes.filter((s) => !s.imageFilename);
        if (targetIds?.length) {
          targets = latestScenes.filter((s) => targetIds.includes(s.id));
        }
        if (!targets.length)
          return "All specified scenes already have images or no scenes found.";

        const effectiveStyle = resolveStyle(
          store.customArtStyle,
          store.artStyle,
        );
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });
        const archiveDir = await imagesDir.getDirectoryHandle("_archive", { create: true });

        let done = 0;
        const results: string[] = [];
        for (const scene of targets) {
          // Archive old scene image if this scene already has one
          if (scene.imageFilename) {
            await archiveFile(scene.imageFilename, sceneDir, archiveDir);
            await archiveFile(scene.imageFilename.replace(/\.png$/, ".txt"), sceneDir, archiveDir);
          }
          // Only reference characters selected for this scene (max 3)
          const sceneCharIds = new Set((scene.characterIds ?? []).slice(0, 3));
          const sceneChars =
            sceneCharIds.size > 0
              ? latestChars.filter((c) => sceneCharIds.has(c.id))
              : [];
          const charRefs =
            sceneChars.length > 0
              ? await resolveCharacterRefs(
                  sceneChars,
                  folderHandle,
                  apiKey,
                  projectId,
                )
              : [];
          const charNames = sceneChars
            .filter((c) => c.name)
            .map((c) => c.name)
            .join(", ");
          const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style.${charNames ? ` Featuring characters: ${charNames}.` : ""} Scene: ${scene.name}. ${scene.description}. Location: ${scene.location || "unspecified"}.${charNames ? " Characters must maintain consistent appearance and design." : ""} Wide establishing shot, dramatic lighting, film composition.`;
          const result = await generateSceneImage(prompt, apiKey, charRefs);
          const imageId = crypto.randomUUID();
          const filename = `${imageId}.png`;
          const localUrl = await saveAndLoadLocal(
            result.url,
            filename,
            sceneDir,
          );
          store.updateScene(scene.id, {
            imageUrl: localUrl,
            imageFilename: filename,
          });
          await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
          done++;
          results.push(`${scene.name}: done`);
        }
        // Sync the sceneImages array used by the UI
        const updated = useMovieStore.getState().scenes;
        store.setSceneImages(
          updated.map((s) => s.imageUrl).filter(Boolean) as string[],
        );
        return `Generated images for ${done} scene(s):\n${results.join("\n")}`;
      },
    },

    {
      name: "generate_scene_image",
      description:
        "Generate or regenerate the AI image for a single specific scene. Use this to create a cinematic keyframe image for one scene, whether it has an existing image or not.",
      parameters: {
        type: "object",
        properties: {
          scene_id: {
            type: "string",
            description: "The ID of the scene to generate the image for.",
          },
        },
        required: ["scene_id"],
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        let latestChars = store.characters;
        let latestScenes = store.scenes;
        try {
          const charsFromDisk = await readCharactersJson(folderHandle, projectId);
          if (charsFromDisk) latestChars = charsFromDisk;
          const scenesFromDisk = await readScenesJson(folderHandle, projectId);
          if (scenesFromDisk) latestScenes = scenesFromDisk;
        } catch {
          // fall back to in-memory data if disk read fails
        }

        const scene = latestScenes.find(
          (s) => s.id === (args.scene_id as string),
        );
        if (!scene)
          return `Error: scene with ID "${args.scene_id}" not found.`;

        const effectiveStyle = resolveStyle(store.customArtStyle, store.artStyle);
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });
        const archiveDir = await imagesDir.getDirectoryHandle("_archive", { create: true });

        // Archive old scene image if this scene already has one
        if (scene.imageFilename) {
          await archiveFile(scene.imageFilename, sceneDir, archiveDir);
          await archiveFile(scene.imageFilename.replace(/\.png$/, ".txt"), sceneDir, archiveDir);
        }

        const sceneCharIds = new Set((scene.characterIds ?? []).slice(0, 3));
        const sceneChars =
          sceneCharIds.size > 0
            ? latestChars.filter((c) => sceneCharIds.has(c.id))
            : [];
        const charRefs =
          sceneChars.length > 0
            ? await resolveCharacterRefs(
                sceneChars,
                folderHandle,
                apiKey,
                projectId,
              )
            : [];
        const charNames = sceneChars
          .filter((c) => c.name)
          .map((c) => c.name)
          .join(", ");

        const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style.${charNames ? ` Featuring characters: ${charNames}.` : ""} Scene: ${scene.name}. ${scene.description}. Location: ${scene.location || "unspecified"}.${charNames ? " Characters must maintain consistent appearance and design." : ""} Wide establishing shot, dramatic lighting, film composition.`;
        const result = await generateSceneImage(prompt, apiKey, charRefs);
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        store.updateScene(scene.id, {
          imageUrl: localUrl,
          imageFilename: filename,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);

        const updated = useMovieStore.getState().scenes;
        store.setSceneImages(
          updated.map((s) => s.imageUrl).filter(Boolean) as string[],
        );
        return `Generated image for scene "${scene.name}".`;
      },
    },

    {
      name: "auto_tag_scene_characters",
      description:
        "Use AI to automatically analyze the story and determine which characters appear in each scene. Updates every scene's characterIds. Call this after extracting scenes and before generating scene images.",
      parameters: {},
      execute: async () => {
        const apiKey = getApiKey();
        if (!apiKey) return "Error: No API key configured.";

        const store = useMovieStore.getState();
        if (!store.story.trim()) return "Error: Story is empty.";
        if (!store.characters.length)
          return "Error: No characters. Extract characters first.";
        if (!store.scenes.length)
          return "Error: No scenes. Extract scenes first.";

        const mapping = await tagSceneCharacters(
          store.story,
          store.characters.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
          })),
          store.scenes.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
          })),
          apiKey,
        );

        let tagged = 0;
        for (const [sceneId, charIds] of Object.entries(mapping)) {
          store.updateScene(sceneId, { characterIds: charIds });
          tagged++;
        }

        const summary = Object.entries(mapping)
          .map(([sid, cids]) => {
            const sceneName =
              store.scenes.find((s) => s.id === sid)?.name || sid;
            const charNames = cids
              .map(
                (cid) =>
                  store.characters.find((c) => c.id === cid)?.name || cid,
              )
              .join(", ");
            return `  ${sceneName}: ${charNames || "none"}`;
          })
          .join("\n");

        return `Tagged characters for ${tagged} scene(s):\n${summary}`;
      },
    },

    {
      name: "update_scene_characters",
      description:
        "Manually set which characters appear in a scene. Use auto_tag_scene_characters for automatic detection, or this for manual adjustments. Max 3 characters per scene.",
      parameters: {
        type: "object",
        properties: {
          scene_id: { type: "string", description: "The scene ID." },
          character_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "List of character IDs that appear in this scene. Max 3.",
          },
        },
        required: ["scene_id", "character_ids"],
      },
      execute: async (args) => {
        const id = args.scene_id as string;
        const charIds = (args.character_ids as string[]).slice(0, 3);
        const store = useMovieStore.getState();
        const scene = store.scenes.find((s) => s.id === id);
        if (!scene) return `Error: scene with ID "${id}" not found.`;
        const validIds = charIds.filter((cid) =>
          store.characters.some((c) => c.id === cid),
        );
        store.updateScene(id, { characterIds: validIds });
        const names = validIds
          .map((cid) => store.characters.find((c) => c.id === cid)?.name || cid)
          .join(", ");
        return `Scene "${scene.name}" now has ${validIds.length} character(s): ${names || "none"}.`;
      },
    },

    {
      name: "generate_scene_scripts",
      description: "Regenerate dialogue/conversations for scenes.",
      parameters: {
        type: "object",
        properties: {
          scene_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "List of scene IDs to generate scripts for. If omitted, generates for all scenes.",
          },
        },
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        if (!apiKey) return "Error: No API key configured.";

        const store = useMovieStore.getState();
        const targetIds = args.scene_ids as string[] | undefined;
        const targets = targetIds?.length
          ? store.scenes.filter((s) => targetIds.includes(s.id))
          : store.scenes;
        if (!targets.length) return "No scenes found.";

        let done = 0;
        for (const scene of targets) {
          const conversations = await regenerateSceneConversations(
            scene.name,
            scene.description,
            apiKey,
            store.language,
          );
          const metadata = await estimateSceneMetadata(
            scene.name,
            scene.description,
            conversations,
            apiKey,
          );
          store.updateScene(scene.id, {
            conversations,
            videoDuration: metadata.videoDuration,
          });
          done++;
        }
        return `Generated scripts for ${done} scene(s).`;
      },
    },

    {
      name: "generate_scene_video",
      description:
        "Generate AI video for a specific scene. Requires the scene to have an image first.",
      parameters: {
        type: "object",
        properties: {
          scene_id: {
            type: "string",
            description: "The scene ID to generate video for.",
          },
        },
        required: ["scene_id"],
      },
      execute: async (args) => {
        const apiKey = getApiKey();
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        if (!apiKey) return "Error: No API key configured.";
        if (!folderHandle || !projectId)
          return "Error: No workspace or project selected.";

        const store = useMovieStore.getState();

        // Reload latest data from disk so we use the freshest scenes and character videos
        let latestChars = store.characters;
        let latestScenes = store.scenes;
        try {
          const charsFromDisk = await readCharactersJson(folderHandle, projectId);
          if (charsFromDisk) latestChars = charsFromDisk;
          const scenesFromDisk = await readScenesJson(folderHandle, projectId);
          if (scenesFromDisk) latestScenes = scenesFromDisk;
        } catch {
          // fall back to in-memory data if disk read fails
        }

        const scene = latestScenes.find((s) => s.id === args.scene_id);
        if (!scene) return `Error: scene "${args.scene_id}" not found.`;
        if (!scene.imageFilename)
          return "Error: Scene has no image. Generate the scene image first.";

        // Load the scene image file from the project's images/scene/ directory
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });
        const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
        const file = await fileHandle.getFile();

        // Resolve character reference video files from clips/ directory
        const referenceIds = scene.videoReferenceIds?.length
          ? new Set(scene.videoReferenceIds)
          : null;
        const videoFiles: File[] = [];
        try {
          const clipsDir = await getProjectClipsDir(folderHandle, projectId);
          for (const char of latestChars) {
            if (!char.videoFilename) continue;
            if (!referenceIds || !referenceIds.has(char.id)) continue;
            try {
              const vfHandle = await clipsDir.getFileHandle(char.videoFilename);
              videoFiles.push(await vfHandle.getFile());
            } catch {
              // file not found, skip
            }
          }
        } catch {
          // clips folder not accessible, continue without reference videos
        }

        const dialogueLines = (scene.conversations || [])
          .map((c) => `${c.person} says: "${c.line}"`)
          .join("\n");
        const prompt = `Scene Title: ${scene.name}. \n\n

      Scene Description: ${scene.description}\n\nScene Location: ${scene.location || "unspecified"}\n\nDuration: ${scene.videoDuration}s.
      No background music. Language & Tone: ${store.language}.
      Must speak the dialogue lines. MUST ignore the words in the attached video.
      The attached video is designed for tone reference.  \n\n ${
        dialogueLines ? `\n\nDialogue lines:\n${dialogueLines}` : ""
      }`;

        const remoteUrl = await uploadAndGenerateVideo(
          file,
          prompt,
          apiKey,
          scene.videoResolution,
          scene.videoAspect,
          videoFiles.length ? videoFiles : undefined,
        );
        const clipsDir = await getProjectClipsDir(folderHandle, projectId);
        const clipsArchiveDir = await clipsDir.getDirectoryHandle("_archive", { create: true });
        // Archive old scene video if this scene already has one
        if (scene.videoFilename) {
          await archiveFile(scene.videoFilename, clipsDir, clipsArchiveDir);
        }
        const videoFilename = `${crypto.randomUUID()}.mp4`;
        const localUrl = await saveAndLoadLocal(
          remoteUrl,
          videoFilename,
          clipsDir,
        );
        store.updateScene(scene.id, { videoUrl: localUrl, videoFilename });
        return `Generated video for scene "${scene.name}".`;
      },
    },

    {
      name: "export_project_zip",
      description: "Export the current project as a ZIP file download.",
      parameters: {},
      execute: async () => {
        const folderHandle = getFolderHandle();
        const projectId = getProjectId();
        const folderName = useFolderStore.getState().folderName;
        if (!folderHandle || !projectId) return "Error: No project selected.";
        await exportProjectAsZip(
          folderHandle,
          projectId,
          folderName ?? "movie-project",
        );
        return "Project exported as ZIP.";
      },
    },

    {
      name: "create_project",
      description: "Create a new project in the workspace.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name." },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const folderHandle = getFolderHandle();
        if (!folderHandle) return "Error: No workspace folder selected.";
        const name = args.name as string;
        const id = await useProjectStore
          .getState()
          .createProject(folderHandle, name);
        useMovieStore.getState().setProjectId(id);
        return `Created project "${name}" with ID: ${id}.`;
      },
    },
  ];
}
