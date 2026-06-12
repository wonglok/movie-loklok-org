"use client";

import { useState, useEffect } from "react";
import { useMovieStore, ART_STYLES, type ArtStyle } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";
import {
  generateImage,
  generateSceneImage,
  extractCharacters,
  extractScenes,
  uploadAndGenerateVideo,
  resolveCharacterRefs,
  regenerateSceneConversations,
  estimateSceneMetadata,
} from "@/lib/fal";
import { resolveStyle } from "@/lib/style";
import {
  readMovieJson,
  readCharactersJson,
  readScenesJson,
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
  const language = useMovieStore((s) => s.language);
  const setLanguage = useMovieStore((s) => s.setLanguage);
  const setCharacterImages = useMovieStore((s) => s.setCharacterImages);
  const setSceneImages = useMovieStore((s) => s.setSceneImages);
  const setCharacters = useMovieStore((s) => s.setCharacters);
  const updateCharacter = useMovieStore((s) => s.updateCharacter);
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
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractingScenes, setExtractingScenes] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [sceneRegenId, setSceneRegenId] = useState<string | null>(null);
  const [scriptRegenId, setScriptRegenId] = useState<string | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(
    null,
  );
  const [generatingAllVideos, setGeneratingAllVideos] = useState(false);
  const [generatingSelectedVideos, setGeneratingSelectedVideos] =
    useState(false);
  const [generatingSelectedScripts, setGeneratingSelectedScripts] =
    useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    type: "character" | "scene";
  } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"character" | "scene">(
    "character",
  );

  const isGenerating =
    generatingCharacters ||
    generatingScenes ||
    extracting ||
    extractingScenes ||
    generatingAllVideos ||
    generatingSelectedVideos ||
    generatingSelectedScripts;
  const effectiveStyle = resolveStyle(customArtStyle, artStyle);
  const hasCharacterImages = characters.some(
    (c) => c.sourceUrl || c.imageFilename,
  );

  const { isSaving } = useAutoSave(
    folderHandle,
    hydrated,
    story,
    artStyle,
    customArtStyle,
    language,
    characters,
    scenes,
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
          )
            setArtStyle(movieData.artStyle as ArtStyle);
          if (movieData.customArtStyle)
            setCustomArtStyle(movieData.customArtStyle);
          if (movieData.language) setLanguage(movieData.language);
        }
        if (charData) setCharacters(charData);
        if (sceneData) setScenes(sceneData);
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
    if (removeTarget === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirmRemove();
      if (e.key === "Escape") setRemoveTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeTarget]);

  const handleConfirmRemove = () => {
    if (removeTarget === null) return;
    const { id, type } = removeTarget;
    if (type === "character") {
      const char = characters.find((c) => c.id === id);
      if (char?.imageUrl) URL.revokeObjectURL(char.imageUrl);
      setCharacters(characters.filter((c) => c.id !== id));
    } else {
      const scene = scenes.find((s) => s.id === id);
      if (scene?.imageUrl) URL.revokeObjectURL(scene.imageUrl);
      setScenes(scenes.filter((s) => s.id !== id));
    }
    setRemoveTarget(null);
  };

  const handleChangeFolder = async () => {
    setPickerError(null);
    try {
      const handle = await window.showDirectoryPicker();
      setStory("");
      setArtStyle("cartoon-3d");
      setCustomArtStyle("");
      setLanguage("English");
      setCharacters([]);
      setScenes([]);
      setCharacterImages([]);
      setSceneImages([]);
      setSelectedScenes(new Set());
      setError(null);
      setSavedPath(null);
      setHydrated(false);
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
      const extracted = await extractCharacters(story, apiKey, language);
      setCharacters(
        extracted.map((c) => ({
          id: crypto.randomUUID(),
          ...c,
          imageUrl: null,
          imageFilename: null,
          sourceUrl: null,
          videoUrl: null,
          videoDuration: 5,
          videoResolution: "720p",
          videoAspect: "9:16",
          conversations: [],
        })),
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
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const characterDir = await imagesDir.getDirectoryHandle("character", {
        create: true,
      });
      for (const char of characters) {
        const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. zoom to show the character's face. grey background. clean character turnaround, consistent design.`;
        const result = await generateImage(prompt, apiKey);
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        const localUrl = await saveAndLoadLocal(
          result.url,
          filename,
          characterDir,
        );
        updateCharacter(char.id, {
          imageUrl: localUrl,
          imageFilename: filename,
          sourceUrl: result.url,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, characterDir);
      }
      setCharacterImages(
        characters.map((c) => c.imageUrl).filter(Boolean) as string[],
      );
      setSavedPath(`${folderName}/images/character`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingCharacters(false);
    }
  };

  const handleRegenerateCharacter = async (id: string) => {
    const char = characters.find((c) => c.id === id);
    if (!char || !apiKey) return;
    setError(null);
    setRegeneratingId(id);
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
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        if (char.imageUrl) URL.revokeObjectURL(char.imageUrl);
        const localUrl = await saveAndLoadLocal(
          result.url,
          filename,
          characterDir,
        );
        updateCharacter(id, { imageUrl: localUrl, imageFilename: filename });
        await savePromptFile(result.prompt, `${imageId}.txt`, characterDir);
      } else {
        updateCharacter(id, { imageUrl: result.url, sourceUrl: result.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleExtractScenes = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setSavedPath(null);
    setExtractingScenes(true);
    try {
      const extracted = await extractScenes(story, apiKey, language);
      setScenes(
        extracted.map((s) => ({
          id: crypto.randomUUID(),
          ...s,
          imageUrl: null,
          imageFilename: null,
          sourceUrl: null,
          videoUrl: null,
          videoDuration: 5,
          videoResolution: "720p",
          videoAspect: "9:16",
          conversations: s.conversations || [],
        })),
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
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const charRefs = await resolveCharacterRefs(
        characters,
        folderHandle,
        apiKey,
      );
      const charNames = characters
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      for (const scene of scenes) {
        const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Featuring characters: ${charNames || "original characters"}. Scene: ${scene.name}. ${scene.description}. Characters must maintain consistent appearance and design. Wide establishing shot, dramatic lighting, film composition.`;
        const result = await generateSceneImage(prompt, apiKey, charRefs);
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        updateScene(scene.id, {
          imageUrl: localUrl,
          imageFilename: filename,
          sourceUrl: result.url,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
      }
      setSceneImages(scenes.map((s) => s.imageUrl).filter(Boolean) as string[]);
      setSavedPath(`${folderName}/images/scene`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingScenes(false);
    }
  };

  const handleRegenerateScene = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !apiKey) return;
    setError(null);
    setSceneRegenId(id);
    try {
      const [charRefs, conversations] = await Promise.all([
        resolveCharacterRefs(characters, folderHandle, apiKey),
        regenerateSceneConversations(
          scene.name,
          scene.description,
          apiKey,
          language,
        ),
      ]);
      const charNames = characters
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      const imagePrompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Featuring characters: ${charNames || "original characters"}. Scene: ${scene.name}. ${scene.description}. Characters must maintain consistent appearance and design. Wide establishing shot, dramatic lighting, film composition.`;
      const [metadata, result] = await Promise.all([
        estimateSceneMetadata(
          scene.name,
          scene.description,
          conversations,
          apiKey,
        ),
        generateSceneImage(imagePrompt, apiKey, charRefs),
      ]);
      if (folderHandle) {
        const imagesDir = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
        const sceneDir = await imagesDir.getDirectoryHandle("scene", {
          create: true,
        });
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        if (scene.imageUrl) URL.revokeObjectURL(scene.imageUrl);
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        updateScene(id, {
          imageUrl: localUrl,
          imageFilename: filename,
          conversations,
          videoDuration: metadata.videoDuration,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
      } else {
        updateScene(id, {
          imageUrl: result.url,
          sourceUrl: result.url,
          conversations,
          videoDuration: metadata.videoDuration,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setSceneRegenId(null);
    }
  };

  const handleRegenerateSceneScript = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !apiKey) return;
    setError(null);
    setScriptRegenId(id);
    try {
      const conversations = await regenerateSceneConversations(
        scene.name,
        scene.description,
        apiKey,
      );
      const metadata = await estimateSceneMetadata(
        scene.name,
        scene.description,
        conversations,
        apiKey,
      );
      updateScene(id, {
        conversations,
        videoDuration: metadata.videoDuration,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Script regeneration failed",
      );
    } finally {
      setScriptRegenId(null);
    }
  };

  const handleGenerateSceneVideo = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene?.imageFilename || !folderHandle || !apiKey) return;
    setError(null);
    setGeneratingVideoId(id);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
      const file = await fileHandle.getFile();
      const dialogueLines = (scene.conversations || [])
        .map((c) => `[${c.camera || "Static Camera"}] ${c.person}: "${c.line}"`)
        .join("\n");
      const prompt = `Language & Tone: ${language}. ${scene.name}. ${scene.description}\n\nDuration: ${scene.videoDuration}s${
        dialogueLines ? `\n\nShots:\n${dialogueLines}` : ""
      }`;
      const videoUrl = await uploadAndGenerateVideo(
        file,
        prompt,
        apiKey,
        scene.videoResolution,
        scene.videoAspect,
        scene.videoDuration,
      );
      updateScene(id, { videoUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingVideoId(null);
    }
  };

  const handleGenerateAllSceneVideos = async () => {
    if (!folderHandle || !apiKey) return;
    setError(null);
    setGeneratingAllVideos(true);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      for (const scene of scenes) {
        if (!scene.imageFilename || scene.videoUrl) continue;
        const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
        const file = await fileHandle.getFile();
        const dialogueLines = (scene.conversations || [])
          .map((c) => `${c.person}: "${c.line}"`)
          .join("\n");
        const prompt = `${scene.name}. ${scene.description}${
          dialogueLines ? `\n\nDialogue:\n${dialogueLines}` : ""
        }`;
        const videoUrl = await uploadAndGenerateVideo(
          file,
          prompt,
          apiKey,
          scene.videoResolution,
          scene.videoAspect,
        );
        updateScene(scene.id, { videoUrl });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingAllVideos(false);
    }
  };

  const toggleSceneSelect = (id: string) => {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerateSelectedImages = async () => {
    if (!selectedScenes.size || isGenerating || !apiKey || !folderHandle)
      return;
    setError(null);
    setGeneratingScenes(true);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const charRefs = await resolveCharacterRefs(
        characters,
        folderHandle,
        apiKey,
      );
      const charNames = characters
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      for (const id of selectedScenes) {
        const scene = scenes.find((s) => s.id === id);
        if (!scene) continue;
        const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Featuring characters: ${charNames || "original characters"}. Scene: ${scene.name}. ${scene.description}. Characters must maintain consistent appearance and design. Wide establishing shot, dramatic lighting, film composition.`;
        const result = await generateSceneImage(prompt, apiKey, charRefs);
        const imageId = crypto.randomUUID();
        const filename = `${imageId}.png`;
        if (scene.imageUrl?.startsWith("blob:"))
          URL.revokeObjectURL(scene.imageUrl);
        const localUrl = await saveAndLoadLocal(result.url, filename, sceneDir);
        updateScene(id, {
          imageUrl: localUrl,
          imageFilename: filename,
          sourceUrl: result.url,
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingScenes(false);
      setSelectedScenes(new Set());
    }
  };

  const handleGenerateSelectedVideos = async () => {
    if (!selectedScenes.size || isGenerating || !apiKey || !folderHandle)
      return;
    setError(null);
    setGeneratingSelectedVideos(true);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      for (const id of selectedScenes) {
        const scene = scenes.find((s) => s.id === id);
        if (!scene?.imageFilename) continue;
        const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
        const file = await fileHandle.getFile();
        const dialogueLines = (scene.conversations || [])
          .map((c) => `${c.person}: "${c.line}"`)
          .join("\n");
        const prompt = `${scene.name}. ${scene.description}${
          dialogueLines ? `\n\nDialogue:\n${dialogueLines}` : ""
        }`;
        const videoUrl = await uploadAndGenerateVideo(
          file,
          prompt,
          apiKey,
          scene.videoResolution,
          scene.videoAspect,
        );
        updateScene(id, { videoUrl });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingSelectedVideos(false);
      setSelectedScenes(new Set());
    }
  };

  const handleGenerateSelectedScripts = async () => {
    if (!selectedScenes.size || isGenerating || !apiKey) return;
    setError(null);
    setGeneratingSelectedScripts(true);
    try {
      for (const id of selectedScenes) {
        const scene = scenes.find((s) => s.id === id);
        if (!scene) continue;
        const conversations = await regenerateSceneConversations(
          scene.name,
          scene.description,
          apiKey,
        );
        const metadata = await estimateSceneMetadata(
          scene.name,
          scene.description,
          conversations,
          apiKey,
        );
        updateScene(id, {
          conversations,
          videoDuration: metadata.videoDuration,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGeneratingSelectedScripts(false);
      setSelectedScenes(new Set());
    }
  };

  const previewItem =
    previewId !== null
      ? previewType === "character"
        ? (characters.find((c) => c.id === previewId) ?? null)
        : (scenes.find((s) => s.id === previewId) ?? null)
      : null;

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

        {removeTarget !== null && (
          <RemoveConfirmModal
            type={removeTarget.type}
            name={
              removeTarget.type === "character"
                ? characters.find((c) => c.id === removeTarget.id)?.name ||
                  "this character"
                : scenes.find((s) => s.id === removeTarget.id)?.name ||
                  "this scene"
            }
            onConfirm={handleConfirmRemove}
            onCancel={() => setRemoveTarget(null)}
          />
        )}

        {previewItem?.imageUrl && (
          <ImagePreviewModal
            imageUrl={previewItem.imageUrl}
            alt={previewItem.name}
            onClose={() => setPreviewId(null)}
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

        {/* Language Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#x1F1EC;&#x1F1E7;</span>
            <h2 className="text-xl font-semibold text-white">Language</h2>
          </div>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="English"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
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
              {characters.map((char) => (
                <CharacterCard
                  key={char.id}
                  char={char}
                  regeneratingId={regeneratingId}
                  onRegenerate={handleRegenerateCharacter}
                  onRemove={(id) => setRemoveTarget({ id, type: "character" })}
                  onPreview={(id) => {
                    setPreviewId(id);
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
                      id: crypto.randomUUID(),
                      name: "",
                      description: "",
                      imageUrl: null,
                      imageFilename: null,
                      sourceUrl: null,
                      videoUrl: null,
                      videoDuration: 5,
                      videoResolution: "720p",
                      videoAspect: "9:16",
                      conversations: [],
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
        {/* {savedPath && (
          <section className="flex justify-center">
            <p className="text-green-400 text-sm bg-green-400/10 rounded-xl px-4 py-3 text-center">
              Saved to {savedPath}
            </p>
          </section>
        )} */}

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
                {selectedScenes.size > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-(--blender-accent) rounded-xl">
                    <span className="text-neutral-400 text-sm flex-1">
                      {selectedScenes.size} scene
                      {selectedScenes.size > 1 ? "s" : ""} selected
                    </span>
                    <button
                      onClick={handleGenerateSelectedImages}
                      disabled={isGenerating || !hasCharacterImages}
                      title={
                        !hasCharacterImages
                          ? "Generate character images first"
                          : undefined
                      }
                      className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {generatingScenes
                        ? "Generating..."
                        : "Generate Selected Images"}
                    </button>
                    <button
                      onClick={handleGenerateSelectedScripts}
                      disabled={isGenerating}
                      className="px-3 py-1.5 border border-neutral-600 rounded-lg text-neutral-300 text-xs font-medium hover:border-neutral-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {generatingSelectedScripts
                        ? "Generating..."
                        : "Generate Selected Scripts"}
                    </button>
                    <button
                      onClick={handleGenerateSelectedVideos}
                      disabled={
                        isGenerating ||
                        generatingAllVideos ||
                        generatingSelectedVideos
                      }
                      className="px-3 py-1.5 border border-neutral-600 rounded-lg text-neutral-300 text-xs font-medium hover:border-neutral-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {generatingSelectedVideos
                        ? "Generating..."
                        : "Generate Selected Videos"}
                    </button>
                    <button
                      onClick={() => setSelectedScenes(new Set())}
                      className="px-2 py-1.5 text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {scenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      sceneRegenId={sceneRegenId}
                      scriptRegenId={scriptRegenId}
                      generatingVideoId={generatingVideoId}
                      selected={selectedScenes.has(scene.id)}
                      onToggleSelect={toggleSceneSelect}
                      onRegenerate={handleRegenerateScene}
                      onRegenerateScript={handleRegenerateSceneScript}
                      onGenerateVideo={handleGenerateSceneVideo}
                      onRemove={(id) => setRemoveTarget({ id, type: "scene" })}
                      onPreview={(id) => {
                        setPreviewId(id);
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
                          id: crypto.randomUUID(),
                          name: "",
                          description: "",
                          imageUrl: null,
                          imageFilename: null,
                          sourceUrl: null,
                          videoUrl: null,
                          videoDuration: 5,
                          videoResolution: "720p",
                          videoAspect: "9:16",
                          conversations: [],
                        },
                      ])
                    }
                    className="px-4 py-2 border border-dashed border-neutral-700 rounded-xl text-neutral-500 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    + Add Scene
                  </button>
                  <button
                    onClick={handleGenerateSceneImages}
                    disabled={isGenerating || !hasCharacterImages}
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
                  {!hasCharacterImages && (
                    <p className="text-amber-400 text-xs">
                      Generate character images first to reference them in
                      scenes.
                    </p>
                  )}
                  {scenes.some((s) => s.imageFilename) && (
                    <button
                      onClick={handleGenerateAllSceneVideos}
                      disabled={
                        isGenerating ||
                        generatingVideoId !== null ||
                        generatingAllVideos
                      }
                      className="px-5 py-2 border border-neutral-700 rounded-xl text-neutral-400 text-sm hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {generatingAllVideos ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-transparent" />{" "}
                          Generating All...
                        </>
                      ) : (
                        "Generate All Videos"
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
