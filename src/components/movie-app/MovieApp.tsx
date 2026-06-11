"use client";

import { useState, useEffect, useRef } from "react";
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
  const fileHandle = await folderHandle.getFileHandle("character.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(characters, null, 2));
  await writable.close();
}

async function extractCharacters(
  story: string,
  apiKey: string,
): Promise<{ name: string; description: string }[]> {
  const res = await fetch("https://fal.run/fal-ai/llama3-8b", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `Extract all characters from this movie story. Return ONLY a valid JSON array of objects with "name" and "description" fields. No other text.\n\nStory: ${story}`,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Character extraction failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  // fal.ai text models return output in data.output or data.choices[0].message.content
  const text = data.output ?? data.choices?.[0]?.message?.content ?? "";
  // Strip markdown code fences if present
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
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const isGenerating = generatingCharacters || generatingScenes || extracting;
  const effectiveStyle = resolveStyle(customArtStyle, artStyle);

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
        const [movieData, charData] = await Promise.all([
          readMovieJson(folderHandle),
          readCharactersJson(folderHandle),
        ]);
        if (movieData) {
          if (movieData.story) setStory(movieData.story);
          if (
            movieData.artStyle &&
            ART_STYLES.some((s) => s.key === movieData.artStyle)
          ) {
            setArtStyle(movieData.artStyle as ArtStyle);
          }
          if (movieData.customArtStyle) setCustomArtStyle(movieData.customArtStyle);
        }
        if (charData) setCharacters(charData);
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
      }));
      setCharacters(withImageUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateCharacterImages = async () => {
    if (!characters.length || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setGeneratingCharacters(true);

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
          const prompt = `Character design reference sheet, ${effectiveStyle} animation style. Character name: ${char.name}. ${char.description}. Full body, clean character turnaround, consistent design.`;

          const result = await generateImage(prompt, apiKey);
          updated[i] = { ...char, imageUrl: result.url };

          const safeName = char.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
          await Promise.all([
            downloadAndSaveImage(result.url, `${safeName}.png`, characterDir),
            savePromptFile(result.prompt, `${safeName}.txt`, characterDir),
          ]);
        }
      } else {
        for (let i = 0; i < updated.length; i++) {
          const char = updated[i];
          const prompt = `Character design reference sheet, ${effectiveStyle} animation style. Character name: ${char.name}. ${char.description}. Full body, clean character turnaround, consistent design.`;

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

  const handleGenerateScenes = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setGeneratingScenes(true);

    try {
      const context = story.substring(0, 800);
      const scenePrompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Wide establishing shot, dramatic lighting, film composition, rich environment details. Based on this story: ${context}`;

      const [result1, result2] = await Promise.all([
        generateImage(scenePrompt, apiKey),
        generateImage(
          scenePrompt + " Different scene, different location variation.",
          apiKey,
        ),
      ]);

      const urls = [result1.url, result2.url];
      setSceneImages(urls);

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });

        await Promise.all([
          downloadAndSaveImage(result1.url, "scene-1.png", sceneDir),
          downloadAndSaveImage(result2.url, "scene-2.png", sceneDir),
          savePromptFile(result1.prompt, "scene-1.txt", sceneDir),
          savePromptFile(result2.prompt, "scene-2.txt", sceneDir),
        ]);

        setSavedPath(`${folderName}/images/scene`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingScenes(false);
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
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
                >
                  <div className="flex gap-4 p-4">
                    <div className="flex-none w-28 aspect-3/4 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700">
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            {characterImages.length > 0 && (
              <button
                onClick={handleGenerateScenes}
                disabled={isGenerating}
                className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
              >
                {generatingScenes ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />
                    Generating...
                  </>
                ) : (
                  "Generate Scenes"
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

        {/* Scene Images */}
        {sceneImages.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x1F3AC;</span>
              <h2 className="text-xl font-semibold text-white">Scenes</h2>
              <span className="text-sm text-neutral-500">
                {sceneImages.length}{" "}
                {sceneImages.length === 1 ? "image" : "images"}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 blender-scrollbar">
              {sceneImages.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-none w-96 aspect-video rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 hover:border-neutral-600 transition-colors group"
                >
                  <img
                    src={url}
                    alt={`Scene ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
