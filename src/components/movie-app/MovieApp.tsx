"use client";

import { useState } from "react";
import { useMovieStore, ART_STYLES } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

const FAL_TEXT2IMG = "https://fal.run/fal-ai/nano-banana";

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

export function MovieApp() {
  const story = useMovieStore((s) => s.story);
  const artStyle = useMovieStore((s) => s.artStyle);
  const characterImages = useMovieStore((s) => s.characterImages);
  const sceneImages = useMovieStore((s) => s.sceneImages);
  const setStory = useMovieStore((s) => s.setStory);
  const setArtStyle = useMovieStore((s) => s.setArtStyle);
  const setCharacterImages = useMovieStore((s) => s.setCharacterImages);
  const setSceneImages = useMovieStore((s) => s.setSceneImages);

  const apiKey = useFolderStore((s) => s.apiKey);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const folderName = useFolderStore((s) => s.folderName);

  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [generatingCharacters, setGeneratingCharacters] = useState(false);
  const [generatingScenes, setGeneratingScenes] = useState(false);

  const isGenerating = generatingCharacters || generatingScenes;

  const handleGenerateCharacters = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setGeneratingCharacters(true);

    try {
      const styleLabel =
        ART_STYLES.find((s) => s.key === artStyle)?.label ?? artStyle;
      const context = story.substring(0, 800);

      const characterPrompt = `Character design reference sheet, ${styleLabel} animation style. Clean character turnaround, full body, consistent character design. Based on this story: ${context}`;

      const [result1, result2] = await Promise.all([
        generateImage(characterPrompt, apiKey),
        generateImage(
          characterPrompt +
            " Different character, different design variation.",
          apiKey,
        ),
      ]);

      const urls = [result1.url, result2.url];
      setCharacterImages(urls);

      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const characterDir = await imagesDir.getDirectoryHandle("character", {
          create: true,
        });

        await Promise.all([
          downloadAndSaveImage(result1.url, "character-1.png", characterDir),
          downloadAndSaveImage(result2.url, "character-2.png", characterDir),
          savePromptFile(result1.prompt, "character-1.txt", characterDir),
          savePromptFile(result2.prompt, "character-2.txt", characterDir),
        ]);

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
      const styleLabel =
        ART_STYLES.find((s) => s.key === artStyle)?.label ?? artStyle;
      const context = story.substring(0, 800);

      const scenePrompt = `Cinematic movie keyframe, ${styleLabel} animation style. Wide establishing shot, dramatic lighting, film composition, rich environment details. Based on this story: ${context}`;

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

  const hasResults = characterImages.length > 0 || sceneImages.length > 0;

  return (
    <div className="h-full overflow-y-auto blender-scrollbar">
      <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-16">
        {/* Header */}
        <section className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Movie Studio
          </h1>
          <p className="text-neutral-400 text-lg max-w-md mx-auto leading-relaxed">
            Bring your story to life with AI-generated characters and scenes
          </p>
        </section>

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
              const isSelected = artStyle === style.key;
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
        </section>

        {/* Generate Buttons */}
        <section className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <button
              onClick={handleGenerateCharacters}
              disabled={!story.trim() || isGenerating}
              className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
            >
              {generatingCharacters ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />
                  Generating...
                </>
              ) : (
                "Generate Characters"
              )}
            </button>
            <button
              onClick={handleGenerateScenes}
              disabled={!story.trim() || isGenerating}
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

        {/* Results */}
        {hasResults && (
          <>
            {/* Character Images */}
            {characterImages.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">&#x1F9D1;&#x200D;&#x1F3A4;</span>
                  <h2 className="text-xl font-semibold text-white">
                    Characters
                  </h2>
                  <span className="text-sm text-neutral-500">
                    {characterImages.length}{" "}
                    {characterImages.length === 1 ? "image" : "images"}
                  </span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 blender-scrollbar">
                  {characterImages.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none w-72 aspect-4/3 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 hover:border-neutral-600 transition-colors group"
                    >
                      <img
                        src={url}
                        alt={`Character ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </a>
                  ))}
                </div>
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
          </>
        )}
      </div>
    </div>
  );
}
