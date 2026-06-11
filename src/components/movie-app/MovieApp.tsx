"use client";

import { useState, useEffect } from "react";
import { useMovieStore, ART_STYLES, type ArtStyle } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";
import {
  generateImage,
  extractCharacters,
  extractScenes,
  extractVideoInfo,
  uploadAndGenerateVideo,
} from "@/lib/fal";
import { resolveStyle } from "@/lib/style";
import {
  readMovieJson,
  readCharactersJson,
  readScenesJson,
  readVideoJson,
  saveAndLoadLocal,
  savePromptFile,
} from "@/lib/fs-helpers";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useLocalImages } from "@/hooks/useLocalImages";
import { SettingsModal } from "./SettingsModal";
import { RemoveConfirmModal } from "./RemoveConfirmModal";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { CharacterCard } from "./CharacterCard";
import { SceneCard } from "./SceneCard";

export function MovieApp() {
  const story = useMovieStore((s) => s.story);
  const artStyle = useMovieStore((s) => s.artStyle);
  const customArtStyle = useMovieStore((s) => s.customArtStyle);
  const characters = useMovieStore((s) => s.characters);
  const scenes = useMovieStore((s) => s.scenes);
  const setStory = useMovieStore((s) => s.setStory);
  const setArtStyle = useMovieStore((s) => s.setArtStyle);
  const setCustomArtStyle = useMovieStore((s) => s.setCustomArtStyle);
  const setCharacterImages = useMovieStore((s) => s.setCharacterImages);
  const setSceneImages = useMovieStore((s) => s.setSceneImages);
  const setCharacters = useMovieStore((s) => s.setCharacters);
  const updateCharacter = useMovieStore((s) => s.updateCharacter);
  const setScenes = useMovieStore((s) => s.setScenes);
  const updateScene = useMovieStore((s) => s.updateScene);
  const videoInfo = useMovieStore((s) => s.videoInfo);
  const setVideoInfo = useMovieStore((s) => s.setVideoInfo);

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
  const [extractingVideo, setExtractingVideo] = useState(false);
  const [generatingVideoIndex, setGeneratingVideoIndex] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null,
  );
  const [sceneRegenIndex, setSceneRegenIndex] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewType, setPreviewType] = useState<"character" | "scene">(
    "character",
  );

  const isGenerating =
    generatingCharacters || generatingScenes || extracting || extractingScenes || extractingVideo || generatingVideoIndex === -1;
  const effectiveStyle = resolveStyle(customArtStyle, artStyle);

  const { isSaving } = useAutoSave(
    folderHandle,
    hydrated,
    story,
    artStyle,
    customArtStyle,
    characters,
    scenes,
    videoInfo,
  );

  useLocalImages(
    folderHandle,
    hydrated,
    characters,
    scenes,
    updateCharacter,
    updateScene,
  );

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

  // Load persisted state on mount
  useEffect(() => {
    if (!folderHandle) {
      setHydrated(true);
      return;
    }
    (async () => {
      try {
        const [movieData, charData, sceneData, videoData] = await Promise.all([
          readMovieJson(folderHandle),
          readCharactersJson(folderHandle),
          readScenesJson(folderHandle),
          readVideoJson(folderHandle),
        ]);
        if (movieData) {
          if (movieData.story) setStory(movieData.story);
          if (
            movieData.artStyle &&
            ART_STYLES.some((s) => s.key === movieData.artStyle)
          )
            setArtStyle(movieData.artStyle as ArtStyle);
          if (movieData.customArtStyle)
            setCustomArtStyle(movieData.customArtStyle);
        }
        if (charData) setCharacters(charData);
        if (sceneData) setScenes(sceneData);
        if (videoData) setVideoInfo(videoData);
      } catch {
        /* use defaults */
      } finally {
        setHydrated(true);
      }
    })();
  }, [
    folderHandle,
    setStory,
    setArtStyle,
    setCustomArtStyle,
    setCharacters,
    setScenes,
  ]);

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

  const handleExtractCharacters = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setExtracting(true);
    try {
      const extracted = await extractCharacters(story, apiKey);
      setCharacters(
        extracted.map((c) => ({ ...c, imageUrl: null, imageFilename: null, sourceUrl: null, videoUrl: null, videoDuration: "~5s", videoCamera: "Static / Slow pan", videoResolution: "720p", videoAspect: "9:16" })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Character extraction failed",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateCharacterImages = async () => {
    if (!characters.length || isGenerating || !apiKey || !folderHandle) return;
    setError(null);
    setSavedPath(null);
    setGeneratingCharacters(true);
    try {
      const updated = [...characters];
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
        updated[i] = { ...char, imageUrl: localUrl, imageFilename: filename, sourceUrl: result.url };
        await savePromptFile(result.prompt, `${id}.txt`, characterDir);
      }
      setCharacters(updated);
      setCharacterImages(
        updated.map((c) => c.imageUrl).filter(Boolean) as string[],
      );
      setSavedPath(`${folderName}/images/character`);
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
        if (char.imageUrl) URL.revokeObjectURL(char.imageUrl);
        const localUrl = await saveAndLoadLocal(
          result.url,
          filename,
          characterDir,
        );
        updateCharacter(index, { imageUrl: localUrl, imageFilename: filename });
        await savePromptFile(result.prompt, `${id}.txt`, characterDir);
      } else {
        updateCharacter(index, { imageUrl: result.url, sourceUrl: result.url });
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
      setScenes(
        extracted.map((s) => ({ ...s, imageUrl: null, imageFilename: null, sourceUrl: null, videoUrl: null, videoDuration: "~5s", videoCamera: "Static / Slow pan", videoResolution: "720p", videoAspect: "9:16" })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scene extraction failed");
    } finally {
      setExtractingScenes(false);
    }
  };

  const handleGenerateSceneImages = async () => {
    if (!scenes.length || isGenerating || !apiKey || !folderHandle) return;
    setError(null);
    setSavedPath(null);
    setGeneratingScenes(true);
    try {
      const updated = [...scenes];
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
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        updated[i] = { ...scene, imageUrl: localUrl, imageFilename: filename, sourceUrl: result.url };
        await savePromptFile(result.prompt, `${id}.txt`, sceneDir);
      }
      setScenes(updated);
      setSceneImages(
        updated.map((s) => s.imageUrl).filter(Boolean) as string[],
      );
      setSavedPath(`${folderName}/images/scene`);
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
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        updateScene(index, { imageUrl: localUrl, imageFilename: filename });
        await savePromptFile(result.prompt, `${id}.txt`, sceneDir);
      } else {
        updateScene(index, { imageUrl: result.url, sourceUrl: result.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setSceneRegenIndex(null);
    }
  };

  const handleExtractVideoInfo = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setExtractingVideo(true);
    try {
      const info = await extractVideoInfo(story, apiKey);
      setVideoInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video extraction failed");
    } finally {
      setExtractingVideo(false);
    }
  };

  const handleGenerateAllSceneVideos = async () => {
    if (!folderHandle || !apiKey) return;
    setError(null);
    setGeneratingVideoIndex(-1); // -1 means "all"
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", { create: true });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", { create: true });
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene.imageFilename || scene.videoUrl) continue;
        const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
        const file = await fileHandle.getFile();
        const prompt = `${scene.name}. ${scene.description}`;
        const videoUrl = await uploadAndGenerateVideo(file, prompt, apiKey);
        updateScene(i, { videoUrl });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingVideoIndex(null);
    }
  };

  const handleGenerateSceneVideo = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.imageFilename || !folderHandle || !apiKey) return;
    setError(null);
    setGeneratingVideoIndex(index);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", { create: true });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", { create: true });
      const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
      const file = await fileHandle.getFile();
      const prompt = `${scene.name}. ${scene.description}`;
      const videoUrl = await uploadAndGenerateVideo(file, prompt, apiKey);
      updateScene(index, { videoUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingVideoIndex(null);
    }
  };

  const previewChar =
    previewType === "character" && previewIndex !== null
      ? characters[previewIndex]
      : null;
  const previewScene =
    previewType === "scene" && previewIndex !== null
      ? scenes[previewIndex]
      : null;
  const previewItem = previewChar ?? previewScene;

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

        {showSettings && (
          <SettingsModal
            folderName={folderName}
            pickerError={pickerError}
            onChangeFolder={handleChangeFolder}
            onClose={() => {
              setShowSettings(false);
              setPickerError(null);
            }}
          />
        )}

        {removeIndex !== null && (
          <RemoveConfirmModal
            name={characters[removeIndex]?.name || "this character"}
            onConfirm={handleConfirmRemove}
            onCancel={() => setRemoveIndex(null)}
          />
        )}

        {previewItem?.imageUrl && (
          <ImagePreviewModal
            imageUrl={previewItem.imageUrl}
            alt={previewItem.name}
            onClose={() => setPreviewIndex(null)}
          />
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
                    className={`text-sm font-medium ${isSelected ? "text-white" : "text-neutral-400"}`}
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
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />{" "}
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
                <CharacterCard
                  key={i}
                  char={char}
                  index={i}
                  regeneratingIndex={regeneratingIndex}
                  onRegenerate={handleRegenerateCharacter}
                  onRemove={setRemoveIndex}
                  onPreview={(idx) => {
                    setPreviewIndex(idx);
                    setPreviewType("character");
                  }}
                  folderHandle={folderHandle}
                  updateCharacter={updateCharacter}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCharacters([
                    ...characters,
                    {
                      name: "",
                      description: "",
                      imageUrl: null,
                      imageFilename: null,
                      sourceUrl: null,
                      videoUrl: null,
                      videoDuration: "~5s",
                      videoCamera: "Static / Slow pan",
                      videoResolution: "720p",
                      videoAspect: "9:16",
                    },
                  ])
                }
                className="px-4 py-2 border border-dashed border-neutral-700 rounded-xl text-neutral-500 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
              >
                + Add Character
              </button>
              <button
                onClick={handleGenerateCharacterImages}
                disabled={isGenerating}
                className="px-6 py-2 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {generatingCharacters ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />{" "}
                    Generating...
                  </>
                ) : (
                  "Generate All Character Images"
                )}
              </button>
            </div>
          </section>
        )}

        {error && (
          <section className="flex justify-center">
            <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3 max-w-md text-center">
              {error}
            </p>
          </section>
        )}

        {/* Saved Indicator */}
        {savedPath && (
          <section className="flex justify-center">
            <p className="text-green-400 text-sm bg-green-400/10 rounded-xl px-4 py-3 text-center">
              Saved to {savedPath}
            </p>
          </section>
        )}

        {/* Scenes Section */}
        {characters.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x1F3AC;</span>
              <h2 className="text-xl font-semibold text-white">Scenes</h2>
              {scenes.length > 0 && (
                <span className="text-sm text-neutral-500">
                  {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
                </span>
              )}
            </div>

            {scenes.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-neutral-500 text-sm">
                  Extract scenes from your story to get started.
                </p>
                <button
                  onClick={handleExtractScenes}
                  disabled={isGenerating}
                  className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
                >
                  {extractingScenes ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />{" "}
                      Extracting Scenes...
                    </>
                  ) : (
                    "Extract Scenes"
                  )}
                </button>
              </div>
            )}

            {scenes.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {scenes.map((scene, i) => (
                    <SceneCard
                      key={i}
                      scene={scene}
                      index={i}
                      sceneRegenIndex={sceneRegenIndex}
                      onRegenerate={handleRegenerateScene}
                      onRemove={setRemoveIndex}
                      onPreview={(idx) => {
                        setPreviewIndex(idx);
                        setPreviewType("scene");
                      }}
                      folderHandle={folderHandle}
                      updateScene={updateScene}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setScenes([
                        ...scenes,
                        {
                          name: "",
                          description: "",
                          imageUrl: null,
                          imageFilename: null,
                          sourceUrl: null,
                          videoUrl: null,
                          videoDuration: "~5s",
                          videoCamera: "Static / Slow pan",
                          videoResolution: "720p",
                          videoAspect: "9:16",
                        },
                      ])
                    }
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
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />{" "}
                        Generating...
                      </>
                    ) : (
                      "Generate All Scene Images"
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Video Section */}
        {characters.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#x1F3A5;</span>
              <h2 className="text-xl font-semibold text-white">Video</h2>
            </div>

            {!videoInfo && (
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-neutral-500 text-sm">
                  Extract video production metadata from your story.
                </p>
                <button
                  onClick={handleExtractVideoInfo}
                  disabled={isGenerating}
                  className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
                >
                  {extractingVideo ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />{" "}
                      Extracting Video Info...
                    </>
                  ) : (
                    "Extract Video Info"
                  )}
                </button>
              </div>
            )}

            {videoInfo && (
              <div className="space-y-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div>
                      <span className="text-neutral-500 text-xs">Title</span>
                      <p className="text-white text-sm font-medium">{videoInfo.title}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-xs">Genre</span>
                      <p className="text-white text-sm font-medium">{videoInfo.genre}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-xs">Duration</span>
                      <p className="text-white text-sm font-medium">{videoInfo.duration}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-xs">Format</span>
                      <p className="text-white text-sm font-medium">{videoInfo.format}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-xs">Resolution</span>
                      <p className="text-white text-sm font-medium">{videoInfo.resolution}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-xs">Framerate</span>
                      <p className="text-white text-sm font-medium">{videoInfo.framerate}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-neutral-500 text-xs">Logline</span>
                      <p className="text-white text-sm">{videoInfo.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExtractVideoInfo}
                    disabled={isGenerating}
                    className="mt-4 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {extractingVideo ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                        Re-extracting...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                        Re-extract
                      </>
                    )}
                  </button>
                </div>

                {/* Per-Scene Video Generation */}
                <div className="grid grid-cols-2 gap-4">
                  {scenes
                    .filter((s) => s.imageFilename)
                    .map((scene) => {
                      const sceneIndex = scenes.indexOf(scene);
                      return (
                        <div
                          key={sceneIndex}
                          className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
                        >
                          <div className="flex gap-4 p-4">
                            <div className="flex-none w-32 aspect-9/16 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700">
                              {scene.imageUrl ? (
                                <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xl text-neutral-600">{scene.name.charAt(0)}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{scene.name}</p>
                              <p className="text-neutral-400 text-xs line-clamp-2">{scene.description}</p>
                              <div className="text-neutral-500 text-xs space-y-1">
                                <input
                                  type="text"
                                  value={scene.videoDuration}
                                  onChange={(e) => updateScene(sceneIndex, { videoDuration: e.target.value })}
                                  className="w-full bg-transparent focus:outline-none placeholder-neutral-600"
                                  placeholder="Duration"
                                />
                                <input
                                  type="text"
                                  value={scene.videoCamera}
                                  onChange={(e) => updateScene(sceneIndex, { videoCamera: e.target.value })}
                                  className="w-full bg-transparent focus:outline-none placeholder-neutral-600"
                                  placeholder="Camera"
                                />
                                <input
                                  type="text"
                                  value={scene.videoResolution}
                                  onChange={(e) => updateScene(sceneIndex, { videoResolution: e.target.value })}
                                  className="w-full bg-transparent focus:outline-none placeholder-neutral-600"
                                  placeholder="Resolution"
                                />
                                <input
                                  type="text"
                                  value={scene.videoAspect}
                                  onChange={(e) => updateScene(sceneIndex, { videoAspect: e.target.value })}
                                  className="w-full bg-transparent focus:outline-none placeholder-neutral-600"
                                  placeholder="Aspect"
                                />
                              </div>
                              {scene.videoUrl ? (
                                <a
                                  href={scene.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="self-start px-3 py-1.5 border border-green-700 rounded-lg text-green-400 text-xs hover:bg-green-400/10 transition-colors"
                                >
                                  View Video
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleGenerateSceneVideo(sceneIndex)}
                                  disabled={generatingVideoIndex !== null}
                                  className="self-start px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                >
                                  {generatingVideoIndex === sceneIndex ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                                      Generating...
                                    </>
                                  ) : (
                                    "Generate Video"
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {scenes.filter((s) => s.imageFilename).length > 0 && (
                  <button
                    onClick={handleGenerateAllSceneVideos}
                    disabled={isGenerating || generatingVideoIndex !== null}
                    className="self-start px-6 py-2 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {generatingVideoIndex === -1 ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />{" "}
                        Generating All...
                      </>
                    ) : (
                      "Generate All Videos"
                    )}
                  </button>
                )}
                {scenes.filter((s) => s.imageFilename).length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    Generate scene images first to enable video generation.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
