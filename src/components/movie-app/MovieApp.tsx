"use client";

import { useState, useEffect, useRef } from "react";
import { fal } from "@fal-ai/client";
import {
  useMovieStore,
  ART_STYLES,
  type ArtStyle,
  type Character,
} from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

const FAL_TEXT2IMG = "https://fal.run/fal-ai/nano-banana";

function resolveStyle(custom: string, preset: ArtStyle): string {
  if (custom.trim()) return custom.trim();
  return ART_STYLES.find((s) => s.key === preset)?.label ?? preset;
}

interface GenerateResult {
  url: string;
  prompt: string;
}

async function generateImage(
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

async function downloadAndSaveImage(
  url: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveAndLoadLocal(
  url: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<string> {
  await downloadAndSaveImage(url, filename, dir);
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

async function loadLocalImage(
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

async function savePromptFile(
  prompt: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(prompt);
  await writable.close();
}

async function readMovieJson(folderHandle: FileSystemDirectoryHandle): Promise<{
  story?: string;
  artStyle?: string;
  customArtStyle?: string;
} | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("movie.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeMovieJson(
  folderHandle: FileSystemDirectoryHandle,
  data: { story: string; artStyle: string; customArtStyle: string },
): Promise<void> {
  const fileHandle = await folderHandle.getFileHandle("movie.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<Character[] | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("character.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
  characters: Character[],
): Promise<void> {
  // Strip object URLs before persisting — they don't survive page reloads
  const toSave = characters.map((c) => ({ ...c, imageUrl: null }));
  const fileHandle = await folderHandle.getFileHandle("character.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

async function readScenesJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<Character[] | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("scene.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeScenesJson(
  folderHandle: FileSystemDirectoryHandle,
  scenes: Character[],
): Promise<void> {
  const toSave = scenes.map((c) => ({ ...c, imageUrl: null }));
  const fileHandle = await folderHandle.getFileHandle("scene.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

async function extractScenes(
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

async function extractCharacters(
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

export function MovieApp() {
  const story = useMovieStore((s) => s.story);
  const artStyle = useMovieStore((s) => s.artStyle);
  const customArtStyle = useMovieStore((s) => s.customArtStyle);
  const characterImages = useMovieStore((s) => s.characterImages);
  const sceneImages = useMovieStore((s) => s.sceneImages);
  const characters = useMovieStore((s) => s.characters);
  const setStory = useMovieStore((s) => s.setStory);
  const setArtStyle = useMovieStore((s) => s.setArtStyle);
  const setCustomArtStyle = useMovieStore((s) => s.setCustomArtStyle);
  const setCharacterImages = useMovieStore((s) => s.setCharacterImages);
  const setSceneImages = useMovieStore((s) => s.setSceneImages);
  const setCharacters = useMovieStore((s) => s.setCharacters);
  const updateCharacter = useMovieStore((s) => s.updateCharacter);
  const scenes = useMovieStore((s) => s.scenes);
  const setScenes = useMovieStore((s) => s.setScenes);
  const updateScene = useMovieStore((s) => s.updateScene);

  const apiKey = useFolderStore((s) => s.apiKey);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const folderName = useFolderStore((s) => s.folderName);
  const setFolder = useFolderStore((s) => s.setFolder);
  const saveApiKey = useFolderStore((s) => s.saveApiKey);

  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [generatingCharacters, setGeneratingCharacters] = useState(false);
  const [generatingScenes, setGeneratingScenes] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingScenes, setExtractingScenes] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null,
  );
  const [sceneRegenIndex, setSceneRegenIndex] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const isGenerating =
    generatingCharacters ||
    generatingScenes ||
    extracting ||
    extractingScenes;
  const effectiveStyle = resolveStyle(customArtStyle, artStyle);

  // Enter key to confirm removal
  useEffect(() => {
    if (removeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirmRemove();
      if (e.key === "Escape") setRemoveIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeIndex]);

  const handleConfirmRemove = () => {
    if (removeIndex === null) return;
    const char = characters[removeIndex];
    if (char.imageUrl) URL.revokeObjectURL(char.imageUrl);
    const next = [...characters];
    next.splice(removeIndex, 1);
    setCharacters(next);
    setRemoveIndex(null);
  };

  const handleChangeFolder = async () => {
    setPickerError(null);
    try {
      const handle = await window.showDirectoryPicker();
      setFolder(handle);
      await saveApiKey(apiKey ?? "");
      setShowSettings(false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPickerError(
        err instanceof Error ? err.message : "Failed to select folder",
      );
    }
  };

  // Load persisted state from movie.json on mount
  useEffect(() => {
    if (!folderHandle) {
      setHydrated(true);
      return;
    }

    (async () => {
      try {
        const [movieData, charData, sceneData] = await Promise.all([
          readMovieJson(folderHandle),
          readCharactersJson(folderHandle),
          readScenesJson(folderHandle),
        ]);
        if (movieData) {
          if (movieData.story) setStory(movieData.story);
          if (
            movieData.artStyle &&
            ART_STYLES.some((s) => s.key === movieData.artStyle)
          ) {
            setArtStyle(movieData.artStyle as ArtStyle);
          }
          if (movieData.customArtStyle)
            setCustomArtStyle(movieData.customArtStyle);
        }
        if (charData) setCharacters(charData);
        if (sceneData) setScenes(sceneData);
      } catch {
        // file doesn't exist yet or can't be read, use defaults
      } finally {
        setHydrated(true);
      }
    })();
  }, [folderHandle, setStory, setArtStyle, setCustomArtStyle, setCharacters]);

  // Auto-save to movie.json
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      writeMovieJson(folderHandle, {
        story,
        artStyle,
        customArtStyle,
      })
        .catch(() => {
          // file write failed, ignore
        })
        .finally(() => setIsSaving(false));
    }, 500);
  }, [story, artStyle, customArtStyle, hydrated, folderHandle]);

  // Auto-save characters to character.json
  const charDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (charDebounceRef.current) clearTimeout(charDebounceRef.current);
    charDebounceRef.current = setTimeout(() => {
      writeCharactersJson(folderHandle, characters).catch(() => {
        // file write failed, ignore
      });
    }, 500);
  }, [characters, hydrated, folderHandle]);

  // Auto-save scenes to scene.json
  const sceneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (sceneDebounceRef.current) clearTimeout(sceneDebounceRef.current);
    sceneDebounceRef.current = setTimeout(() => {
      writeScenesJson(folderHandle, scenes).catch(() => {
        // file write failed, ignore
      });
    }, 500);
  }, [scenes, hydrated, folderHandle]);

  // Load local images after hydration
  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    (async () => {
      try {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const characterDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });

        for (let i = 0; i < characters.length; i++) {
          const char = characters[i];
          if (char.imageFilename) {
            const localUrl = await loadLocalImage(
              char.imageFilename,
              characterDir,
            );
            if (localUrl) {
              if (char.imageUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(char.imageUrl);
              }
              updateCharacter(i, { imageUrl: localUrl });
            }
          }
        }

        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          if (scene.imageFilename) {
            const localUrl = await loadLocalImage(
              scene.imageFilename,
              sceneDir,
            );
            if (localUrl) {
              if (scene.imageUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(scene.imageUrl);
              }
              updateScene(i, { imageUrl: localUrl });
            }
          }
        }
      } catch {
        // folder not ready, ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      for (const char of characters) {
        if (char.imageUrl) URL.revokeObjectURL(char.imageUrl);
      }
      for (const scene of scenes) {
        if (scene.imageUrl) URL.revokeObjectURL(scene.imageUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExtractCharacters = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setExtracting(true);

    try {
      const extracted = await extractCharacters(story, apiKey);
      const withImageUrls: Character[] = extracted.map((c) => ({
        ...c,
        imageUrl: null,
        imageFilename: null,
      }));
      setCharacters(withImageUrls);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Character extraction failed",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateCharacterImages = async () => {
    if (!characters.length || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setGeneratingCharacters(true);
    if (!folderHandle) {
      return;
    }

    try {
      const updated = [...characters];

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const characterDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });

        for (let i = 0; i < updated.length; i++) {
          const char = updated[i];
          const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. zoom to show the character's face. grey background. clean character turnaround, consistent design.`;

          const result = await generateImage(prompt, apiKey);
          const id = crypto.randomUUID();
          const filename = `${id}.png`;

          const localUrl = await saveAndLoadLocal(
            result.url,
            filename,
            characterDir,
          );
          updated[i] = {
            ...char,
            imageUrl: localUrl,
            imageFilename: filename,
          };

          await savePromptFile(result.prompt, `${id}.txt`, characterDir);
        }
      } else {
        for (let i = 0; i < updated.length; i++) {
          const char = updated[i];
          const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. zoom to show the character's face. grey background. clean character turnaround, consistent design.`;

          const result = await generateImage(prompt, apiKey);
          updated[i] = { ...char, imageUrl: result.url };
        }
      }

      setCharacters(updated);
      setCharacterImages(
        updated.map((c) => c.imageUrl).filter(Boolean) as string[],
      );

      if (folderHandle) {
        setSavedPath(`${folderName}/images/character`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingCharacters(false);
    }
  };

  const handleRegenerateCharacter = async (index: number) => {
    const char = characters[index];
    if (!char || !apiKey) return;
    setError(null);
    setRegeneratingIndex(index);

    try {
      const prompt = `Character design reference sheet, ${effectiveStyle} animation style. Character name: ${char.name}. ${char.description}. Full body, clean character turnaround, consistent design.`;
      const result = await generateImage(prompt, apiKey);

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const characterDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });
        const id = crypto.randomUUID();
        const filename = `${id}.png`;

        // Revoke old object URL
        if (char.imageUrl) URL.revokeObjectURL(char.imageUrl);

        const localUrl = await saveAndLoadLocal(
          result.url,
          filename,
          characterDir,
        );
        updateCharacter(index, {
          imageUrl: localUrl,
          imageFilename: filename,
        });

        await savePromptFile(result.prompt, `${id}.txt`, characterDir);
      } else {
        updateCharacter(index, { imageUrl: result.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleExtractScenes = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setExtractingScenes(true);

    try {
      const extracted = await extractScenes(story, apiKey);
      const withImageUrls: Character[] = extracted.map((s) => ({
        ...s,
        imageUrl: null,
        imageFilename: null,
      }));
      setScenes(withImageUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scene extraction failed");
    } finally {
      setExtractingScenes(false);
    }
  };

  const handleGenerateSceneImages = async () => {
    if (!scenes.length || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setGeneratingScenes(true);

    try {
      const updated = [...scenes];

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });

        for (let i = 0; i < updated.length; i++) {
          const scene = updated[i];
          const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Scene: ${scene.name}. ${scene.description}. Wide establishing shot, dramatic lighting, film composition.`;

          const result = await generateImage(prompt, apiKey);
          const id = crypto.randomUUID();
          const filename = `${id}.png`;

          const localUrl = await saveAndLoadLocal(
            result.url,
            filename,
            sceneDir,
          );
          updated[i] = {
            ...scene,
            imageUrl: localUrl,
            imageFilename: filename,
          };

          await savePromptFile(result.prompt, `${id}.txt`, sceneDir);
        }
      } else {
        for (let i = 0; i < updated.length; i++) {
          const scene = updated[i];
          const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Scene: ${scene.name}. ${scene.description}. Wide establishing shot, dramatic lighting, film composition.`;

          const result = await generateImage(prompt, apiKey);
          updated[i] = { ...scene, imageUrl: result.url };
        }
      }

      setScenes(updated);
      setSceneImages(
        updated.map((s) => s.imageUrl).filter(Boolean) as string[],
      );

      if (folderHandle) {
        setSavedPath(`${folderName}/images/scene`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingScenes(false);
    }
  };

  const handleRegenerateScene = async (index: number) => {
    const scene = scenes[index];
    if (!scene || !apiKey) return;
    setError(null);
    setSceneRegenIndex(index);

    try {
      const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Scene: ${scene.name}. ${scene.description}. Wide establishing shot, dramatic lighting, film composition.`;
      const result = await generateImage(prompt, apiKey);

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });
        const id = crypto.randomUUID();
        const filename = `${id}.png`;

        if (scene.imageUrl) URL.revokeObjectURL(scene.imageUrl);

        const localUrl = await saveAndLoadLocal(
          result.url,
          filename,
          sceneDir,
        );
        updateScene(index, {
          imageUrl: localUrl,
          imageFilename: filename,
        });

        await savePromptFile(result.prompt, `${id}.txt`, sceneDir);
      } else {
        updateScene(index, { imageUrl: result.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setSceneRegenIndex(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto blender-scrollbar">
      <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-16">
        {/* Header */}
        <section className="relative text-center">
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-0 right-0 p-2 text-neutral-500 hover:text-white transition-colors rounded-xl hover:bg-neutral-800"
            title="Settings"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Movie Studio
          </h1>
          <p className="text-neutral-400 text-lg max-w-md mx-auto leading-relaxed">
            Bring your story to life with AI-generated characters and scenes
          </p>
          {isSaving && (
            <p className="text-neutral-500 text-xs mt-3 animate-pulse">
              Saving...
            </p>
          )}
        </section>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                Settings
              </h2>
              <p className="text-neutral-400 text-sm mb-6">
                Current workspace:{" "}
                <span className="text-neutral-300 font-mono">{folderName}</span>
              </p>

              {pickerError && (
                <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
                  {pickerError}
                </p>
              )}

              <button
                onClick={handleChangeFolder}
                className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors mb-3"
              >
                Change Workspace Folder
              </button>

              <button
                onClick={() => {
                  setShowSettings(false);
                  setPickerError(null);
                }}
                className="w-full px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
        {/* End Settings Modal */}

        {/* Remove Confirmation Modal */}
        {removeIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
              <p className="text-white text-lg font-semibold mb-2">
                Remove Character
              </p>
              <p className="text-neutral-400 text-sm mb-6">
                Are you sure you want to remove{" "}
                <span className="text-white font-medium">
                  {characters[removeIndex]?.name || "this character"}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemoveIndex(null)}
                  className="flex-1 px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemove}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewIndex !== null && characters[previewIndex]?.imageUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewIndex(null)}
          >
            <button
              onClick={() => setPreviewIndex(null)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={characters[previewIndex].imageUrl!}
              alt={characters[previewIndex].name}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Story Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#x1F4D6;</span>
            <h2 className="text-xl font-semibold text-white">Story</h2>
          </div>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Write your movie story here... Describe the characters, their personalities, the world they live in, and the key scenes you want to visualize."
            rows={8}
            className="w-full px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white text-sm leading-relaxed placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors resize-none blender-scrollbar"
          />
        </section>

        {/* Art Direction Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#x1F3A8;</span>
            <h2 className="text-xl font-semibold text-white">Art Direction</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ART_STYLES.map((style) => {
              const isSelected =
                !customArtStyle.trim() && artStyle === style.key;
              return (
                <button
                  key={style.key}
                  onClick={() => setArtStyle(style.key)}
                  className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-(--blender-accent) bg-(--blender-accent)/10"
                      : "border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800/50"
                  }`}
                >
                  <span className="text-3xl">{style.emoji}</span>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-white" : "text-neutral-400"
                    }`}
                  >
                    {style.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-neutral-400">
              Or type a custom style:
            </label>
            <input
              type="text"
              value={customArtStyle}
              onChange={(e) => setCustomArtStyle(e.target.value)}
              placeholder="e.g. Studio Ghibli, pixel art, watercolor..."
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>
        </section>

        {/* Extract Characters Button */}
        {characters.length === 0 && (
          <section className="flex flex-col items-center gap-4">
            <button
              onClick={handleExtractCharacters}
              disabled={!story.trim() || isGenerating}
              className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
            >
              {extracting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />
                  Extracting Characters...
                </>
              ) : (
                "Extract Characters"
              )}
            </button>
          </section>
        )}

        {/* Character Cards */}
        {characters.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x1F9D1;&#x200D;&#x1F3A4;</span>
              <h2 className="text-xl font-semibold text-white">Characters</h2>
              <span className="text-sm text-neutral-500">
                {characters.length}{" "}
                {characters.length === 1 ? "character" : "characters"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {characters.map((char, i) => (
                <div
                  key={i}
                  className="relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group/card"
                >
                  <button
                    onClick={() => setRemoveIndex(i)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100 transition-all"
                    title="Remove character"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                  <div className="flex gap-4 p-4">
                    <div
                      className={`flex-none w-28 aspect-3/4 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 ${
                        char.imageUrl
                          ? "cursor-zoom-in hover:border-neutral-500 transition-colors"
                          : ""
                      }`}
                      onClick={() => {
                        if (char.imageUrl) setPreviewIndex(i);
                      }}
                    >
                      {char.imageUrl ? (
                        <img
                          src={char.imageUrl}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl text-neutral-600">
                            {char.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) =>
                          updateCharacter(i, { name: e.target.value })
                        }
                        placeholder="Character name"
                        className="w-full bg-transparent text-white font-semibold text-sm focus:outline-none placeholder-neutral-600"
                      />
                      <textarea
                        value={char.description}
                        onChange={(e) =>
                          updateCharacter(i, { description: e.target.value })
                        }
                        placeholder="Character description"
                        rows={3}
                        className="w-full bg-transparent text-neutral-400 text-xs leading-relaxed focus:outline-none placeholder-neutral-600 resize-none blender-scrollbar"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRegenerateCharacter(i)}
                          disabled={regeneratingIndex !== null}
                          className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                          {regeneratingIndex === i ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                              </svg>
                              Regenerate
                            </>
                          )}
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          id={`char-upload-${i}`}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !folderHandle) return;
                            try {
                              const imagesDir = await folderHandle.getDirectoryHandle("images", { create: true });
                              const characterDir = await imagesDir.getDirectoryHandle("character", { create: true });
                              const id = crypto.randomUUID();
                              const filename = `${id}.png`;
                              const fileHandle = await characterDir.getFileHandle(filename, { create: true });
                              const writable = await fileHandle.createWritable();
                              await writable.write(file);
                              await writable.close();
                              if (char.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(char.imageUrl);
                              const localUrl = URL.createObjectURL(file);
                              updateCharacter(i, { imageUrl: localUrl, imageFilename: filename });
                            } catch {
                              // upload failed, ignore
                            }
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => document.getElementById(`char-upload-${i}`)?.click()}
                          className="px-2 py-1.5 border border-neutral-700 rounded-lg text-neutral-500 text-xs hover:border-neutral-500 hover:text-neutral-300 transition-colors"
                          title="Upload image"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setCharacters([
                  ...characters,
                  {
                    name: "",
                    description: "",
                    imageUrl: null,
                    imageFilename: null,
                  },
                ])
              }
              className="self-start px-4 py-2 border border-dashed border-neutral-700 rounded-xl text-neutral-500 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
            >
              + Add Character
            </button>
          </section>
        )}

        {/* Generate Buttons */}
        <section className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
            {characters.length > 0 && (
              <button
                onClick={handleGenerateCharacterImages}
                disabled={isGenerating}
                className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
              >
                {generatingCharacters ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />
                    Generating...
                  </>
                ) : (
                  "Generate All Character Images"
                )}
              </button>
            )}
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3 max-w-md text-center">
              {error}
            </p>
          )}
        </section>

        {/* Saved Indicator */}
        {savedPath && (
          <section className="flex justify-center">
            <p className="text-green-400 text-sm bg-green-400/10 rounded-xl px-4 py-3 text-center">
              Saved to {savedPath}
            </p>
          </section>
        )}

        {/* Section Divider */}
        {characterImages.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-600 text-sm">Scenes</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>
        )}

        {/* Extract Scenes Button */}
        {characterImages.length > 0 && scenes.length === 0 && (
          <section className="flex flex-col items-center gap-4">
            <button
              onClick={handleExtractScenes}
              disabled={isGenerating}
              className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
            >
              {extractingScenes ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />
                  Extracting Scenes...
                </>
              ) : (
                "Extract Scenes"
              )}
            </button>
          </section>
        )}

        {/* Scene Cards */}
        {scenes.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x1F3AC;</span>
              <h2 className="text-xl font-semibold text-white">Scenes</h2>
              <span className="text-sm text-neutral-500">
                {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  className="relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group/card"
                >
                  <button
                    onClick={() => setRemoveIndex(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100 transition-all"
                    title="Remove scene"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex gap-4 p-4">
                    <div
                      className={`flex-none w-44 aspect-video rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 ${
                        scene.imageUrl ? "cursor-zoom-in hover:border-neutral-500 transition-colors" : ""
                      }`}
                      onClick={() => { if (scene.imageUrl) setPreviewIndex(null); }}
                    >
                      {scene.imageUrl ? (
                        <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl text-neutral-600">{scene.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <input
                        type="text"
                        value={scene.name}
                        onChange={(e) => updateScene(i, { name: e.target.value })}
                        placeholder="Scene name"
                        className="w-full bg-transparent text-white font-semibold text-sm focus:outline-none placeholder-neutral-600"
                      />
                      <textarea
                        value={scene.description}
                        onChange={(e) => updateScene(i, { description: e.target.value })}
                        placeholder="Scene description"
                        rows={3}
                        className="w-full bg-transparent text-neutral-400 text-xs leading-relaxed focus:outline-none placeholder-neutral-600 resize-none blender-scrollbar"
                      />
                      <button
                        onClick={() => handleRegenerateScene(i)}
                        disabled={sceneRegenIndex !== null}
                        className="self-start px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                      >
                        {sceneRegenIndex === i ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                            </svg>
                            Regenerate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setScenes([...scenes, { name: "", description: "", imageUrl: null, imageFilename: null }])}
                className="px-4 py-2 border border-dashed border-neutral-700 rounded-xl text-neutral-500 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
              >
                + Add Scene
              </button>
              <button
                onClick={handleGenerateSceneImages}
                disabled={isGenerating}
                className="px-6 py-2 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {generatingScenes ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />
                    Generating...
                  </>
                ) : (
                  "Generate All Scene Images"
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
