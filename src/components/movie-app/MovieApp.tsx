"use client";

import { useState, useEffect } from "react";
import { useMovieStore, ART_STYLES, type ArtStyle } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";
import { useProjectStore } from "@/stores/project-store";
import {
  generateImage,
  generateSceneImage,
  extractCharacters,
  extractScenes,
  uploadAndGenerateVideo,
  resolveCharacterRefs,
  regenerateSceneConversations,
  estimateSceneMetadata,
  regenerateSceneDescription,
  regenerateSceneLocation,
} from "@/lib/fal";
import { resolveStyle } from "@/lib/style";
import {
  readMovieJson,
  readCharactersJson,
  readScenesJson,
  readChatJson,
  saveAndLoadLocal,
  savePromptFile,
  loadLocalImage,
  exportProjectAsZip,
  getProjectImagesDir,
  getProjectClipsDir,
} from "@/lib/fs-helpers";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useLocalImages } from "@/hooks/useLocalImages";
import { generatePptx } from "@/lib/ebook";
import { SettingsModal } from "./SettingsModal";
import { RemoveConfirmModal } from "./RemoveConfirmModal";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { CharacterCard } from "./CharacterCard";
import { SceneCard } from "./SceneCard";
import { MovieEditor } from "./MovieEditor";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ProjectTabs } from "./ProjectTabs";
import { AgentProgressPanel } from "./AgentProgressPanel";
import { ChatPanel } from "./ChatPanel";
import { useChatStore } from "@/stores/chat-store";
import QRCode from "react-qr-code";
// import Strands from "../backgrounds/Strands";

export function MovieApp() {
  const story = useMovieStore((s) => s.story);
  const artStyle = useMovieStore((s) => s.artStyle);
  const customArtStyle = useMovieStore((s) => s.customArtStyle);
  const characters = useMovieStore((s) => s.characters);
  const scenes = useMovieStore((s) => s.scenes);
  const projectId = useMovieStore((s) => s.projectId);
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
  const setProjectId = useMovieStore((s) => s.setProjectId);
  const setIsGenerating = useMovieStore((s) => s.setIsGenerating);
  const resetProject = useMovieStore((s) => s.resetProject);
  const apiKey = useFolderStore((s) => s.apiKey);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const folderName = useFolderStore((s) => s.folderName);
  const setFolder = useFolderStore((s) => s.setFolder);
  const saveApiKey = useFolderStore((s) => s.saveApiKey);
  const setActiveProjectId = useFolderStore((s) => s.setActiveProjectId);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const importProject = useProjectStore((s) => s.importProject);

  const [error, setError] = useState<string | null>(null);
  const [generatingCharacters, setGeneratingCharacters] = useState(false);
  const [generatingSelectedImages, setGeneratingSelectedImages] =
    useState(false);
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractingScenes, setExtractingScenes] = useState(false);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(
    new Set(),
  );
  const [referenceVideoGeneratingIds, setReferenceVideoGeneratingIds] =
    useState<Set<string>>(new Set());
  const [imageRegenId, setImageRegenId] = useState<string | null>(null);
  const [descRegenId, setDescRegenId] = useState<string | null>(null);
  const [scriptRegenId, setScriptRegenId] = useState<string | null>(null);
  const [locationRegenId, setLocationRegenId] = useState<string | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(
    null,
  );
  const [generatingSelectedVideos, setGeneratingSelectedVideos] =
    useState(false);
  const [generatingSelectedScripts, setGeneratingSelectedScripts] =
    useState(false);
  const [selectedProgress, setSelectedProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
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
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [creatingFirstProject, setCreatingFirstProject] = useState(false);
  const [firstProjectName, setFirstProjectName] = useState("");

  const chatOpen = useChatStore((s) => s.isOpen);
  const isSending = useChatStore((s) => s.isSending);

  const isGenerating =
    generatingCharacters ||
    generatingSelectedImages ||
    extracting ||
    extractingScenes ||
    generatingSelectedVideos ||
    generatingSelectedScripts ||
    selectedProgress !== null;

  const aiProcessing = isGenerating || isSending;

  useEffect(() => {
    setIsGenerating(isGenerating);
  }, [isGenerating, setIsGenerating]);

  const effectiveStyle = resolveStyle(customArtStyle, artStyle);
  const hasCharacterImages = characters.some(
    (c) => c.sourceUrl || c.imageFilename,
  );

  const { isSaving } = useAutoSave(
    folderHandle,
    projectId,
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
    projectId,
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
        if (char.videoUrl) URL.revokeObjectURL(char.videoUrl);
      }
      for (const scene of scenes) {
        if (scene.imageUrl) URL.revokeObjectURL(scene.imageUrl);
        if (scene.videoUrl) URL.revokeObjectURL(scene.videoUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load projects list when workspace is configured
  useEffect(() => {
    if (!folderHandle) {
      setHydrated(true);
      return;
    }
    (async () => {
      await loadProjects(folderHandle);
      setHydrated(true);
    })();
  }, [folderHandle, loadProjects]);

  // Load project data when active project changes
  useEffect(() => {
    if (!hydrated || !folderHandle || !activeProjectId) return;
    const currentId = useMovieStore.getState().projectId;
    if (currentId === activeProjectId) return;

    (async () => {
      try {
        const [movieData, charData, sceneData, chatData] = await Promise.all([
          readMovieJson(folderHandle, activeProjectId),
          readCharactersJson(folderHandle, activeProjectId),
          readScenesJson(folderHandle, activeProjectId),
          readChatJson(folderHandle, activeProjectId),
        ]);
        resetProject();
        setProjectId(activeProjectId);
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
        // Load chat history for this project
        useChatStore.getState().setMessages(chatData ?? []);
        useChatStore
          .getState()
          .setSaveHandle({ folderHandle, projectId: activeProjectId });
      } catch {
        /* use defaults */
      }
    })();
  }, [
    hydrated,
    folderHandle,
    activeProjectId,
    resetProject,
    setProjectId,
    setStory,
    setArtStyle,
    setCustomArtStyle,
    setCharacters,
    setScenes,
    setLanguage,
  ]);

  // Load videos from project clips/ folder
  useEffect(() => {
    if (!hydrated || !folderHandle || !projectId) return;
    (async () => {
      try {
        const clipsDir = await getProjectClipsDir(folderHandle, projectId);
        for (const char of characters) {
          if (char.videoFilename && !char.videoUrl) {
            const localUrl = await loadLocalImage(char.videoFilename, clipsDir);
            if (localUrl) updateCharacter(char.id, { videoUrl: localUrl });
          }
        }
        for (const scene of scenes) {
          if (scene.videoFilename && !scene.videoUrl) {
            const localUrl = await loadLocalImage(
              scene.videoFilename,
              clipsDir,
            );
            if (localUrl) updateScene(scene.id, { videoUrl: localUrl });
          }
        }
      } catch {
        // folder not ready, ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, projectId]);

  // Auto-save chat messages when they change
  useEffect(() => {
    if (!hydrated || !folderHandle || !projectId) return;
    const timer = setTimeout(() => {
      useChatStore.getState().persistMessages();
    }, 1000);
    return () => clearTimeout(timer);
  }, [hydrated, folderHandle, projectId, useChatStore((s) => s.messages)]);

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
      if (char?.videoUrl) URL.revokeObjectURL(char.videoUrl);
      setCharacters(characters.filter((c) => c.id !== id));
    } else {
      const scene = scenes.find((s) => s.id === id);
      if (scene?.imageUrl) URL.revokeObjectURL(scene.imageUrl);
      if (scene?.videoUrl) URL.revokeObjectURL(scene.videoUrl);
      setScenes(scenes.filter((s) => s.id !== id));
    }
    setRemoveTarget(null);
  };

  const handleChangeFolder = async () => {
    setPickerError(null);
    try {
      const handle = await window.showDirectoryPicker();
      resetProject();
      setProjectId(null);
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
      setHydrated(false);
      setFolder(handle);
      await saveApiKey(apiKey ?? "");
      await loadProjects(handle);
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
    setExtracting(true);
    try {
      const extracted = await extractCharacters(story, apiKey, language);

      setCharacters([
        ...characters,
        ...extracted.map((c) => ({
          id: crypto.randomUUID(),
          ...c,
          location: "",
          imageUrl: null,
          imageFilename: null,
          sourceUrl: null,
          videoUrl: null,
          videoFilename: null,
          videoDuration: 5,
          videoResolution: "480p",
          videoAspect: "9:16",
          videoReferenceIds: [],
          characterIds: [],
          conversations: [],
        })),
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Character extraction failed",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateCharacterImages = async () => {
    if (
      !characters.length ||
      isGenerating ||
      !apiKey ||
      !folderHandle ||
      !projectId
    )
      return;
    setError(null);
    setGeneratingCharacters(true);
    try {
      // Reload latest character data from disk so we use the freshest names/descriptions
      let latestChars = characters;
      try {
        const fromDisk = await readCharactersJson(folderHandle, projectId);
        if (fromDisk) latestChars = fromDisk;
      } catch {
        // fall back to in-memory characters if disk read fails
      }
      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const characterDir = await imagesDir.getDirectoryHandle("character", {
        create: true,
      });
      await Promise.all(
        latestChars.map(async (char) => {
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
        }),
      );
      setCharacterImages(
        characters.map((c) => c.imageUrl).filter(Boolean) as string[],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingCharacters(false);
    }
  };

  const handleRegenerateCharacter = async (id: string) => {
    // Reload latest character data from disk so we use the freshest name/description
    let latestChars = characters;
    if (folderHandle && projectId) {
      try {
        const fromDisk = await readCharactersJson(folderHandle, projectId);
        if (fromDisk) latestChars = fromDisk;
      } catch {
        // fall back to in-memory characters if disk read fails
      }
    }
    const char = latestChars.find((c) => c.id === id);
    if (!char || !apiKey) return;
    setError(null);
    setRegeneratingIds((prev) => new Set(prev).add(id));
    try {
      const prompt = `Face Image. ${effectiveStyle} style. Character name: ${char.name}. ${char.description}. MUST NOT draw any text. Close-up portrait zoomed in on the character's face, single front-facing view only, no multiple views, no turnaround. Neutral facial expression. Grey background.`;
      const result = await generateImage(prompt, apiKey);
      if (folderHandle && projectId) {
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
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
        updateCharacter(id, { imageUrl: localUrl, imageFilename: filename, sourceUrl: result.url });
        await savePromptFile(result.prompt, `${imageId}.txt`, characterDir);
      } else {
        updateCharacter(id, { imageUrl: result.url, sourceUrl: result.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGenerateReferenceVideo = async (id: string) => {
    // Reload latest character data from disk so we use the freshest name/description
    let latestChars = characters;
    if (folderHandle && projectId) {
      try {
        const fromDisk = await readCharactersJson(folderHandle, projectId);
        if (fromDisk) latestChars = fromDisk;
      } catch {
        // fall back to in-memory characters if disk read fails
      }
    }
    const char = latestChars.find((c) => c.id === id);
    if (!char?.imageFilename || !folderHandle || !apiKey || !projectId) return;
    setError(null);
    setReferenceVideoGeneratingIds((prev) => new Set(prev).add(id));
    try {
      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const characterDir = await imagesDir.getDirectoryHandle("character", {
        create: true,
      });
      const fileHandle = await characterDir.getFileHandle(char.imageFilename);
      const file = await fileHandle.getFile();
      const prompt = `Close-up portrait shot of the character facing the camera. The character says: "Hi! I'm ${char.name}!". Character's Voice Description: ${JSON.stringify(char.description)} The duration is around 3 seconds. The camera stays static, focused on the character's face with natural expression and lip-sync to the spoken words. Simple neutral background. Language & Tone: ${language}. No background music`;
      const remoteUrl = await uploadAndGenerateVideo(
        file,
        prompt,
        apiKey,
        "480p",
        "9:16",
      );
      const clipsDir = await getProjectClipsDir(folderHandle, projectId!);
      const videoFilename = `${crypto.randomUUID()}.mp4`;
      const localUrl = await saveAndLoadLocal(
        remoteUrl,
        videoFilename,
        clipsDir,
      );
      updateCharacter(id, { videoUrl: localUrl, videoFilename });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Reference video generation failed",
      );
    } finally {
      setReferenceVideoGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleExtractScenes = async () => {
    if (!story.trim() || isGenerating || !apiKey) return;
    setError(null);
    setExtractingScenes(true);
    try {
      const extracted = await extractScenes(
        story,
        apiKey,
        language,
        characters.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
        })),
      );
      setScenes(
        extracted.map((s) => ({
          id: crypto.randomUUID(),
          ...s,
          imageUrl: null,
          imageFilename: null,
          sourceUrl: null,
          videoUrl: null,
          videoFilename: null,
          videoDuration: 5,
          videoResolution: "480p",
          videoAspect: "9:16",
          videoReferenceIds: [],
          characterIds: s.characterIds || [],
          conversations: s.conversations || [],
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scene extraction failed");
    } finally {
      setExtractingScenes(false);
    }
  };

  const handleRegenerateSceneImage = async (id: string) => {
    if (!apiKey) return;
    setError(null);
    setImageRegenId(id);
    try {
      // Reload latest data from disk so we use the freshest characters, scenes, and images
      let latestChars = characters;
      let latestScenes = scenes;
      if (folderHandle && projectId) {
        try {
          const charsFromDisk = await readCharactersJson(folderHandle, projectId);
          if (charsFromDisk) latestChars = charsFromDisk;
          const scenesFromDisk = await readScenesJson(folderHandle, projectId);
          if (scenesFromDisk) latestScenes = scenesFromDisk;
        } catch {
          // fall back to in-memory data if disk read fails
        }
      }
      const scene = latestScenes.find((s) => s.id === id);
      if (!scene) return;
      // Only reference characters selected for this scene
      const sceneCharIds = new Set(scene.characterIds ?? []);
      const sceneChars =
        sceneCharIds.size > 0
          ? latestChars.filter((c) => sceneCharIds.has(c.id))
          : [];
      const charRefs = await resolveCharacterRefs(
        sceneChars,
        folderHandle,
        apiKey,
        projectId ?? undefined,
      );
      const charNames = sceneChars
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      const imagePrompt = `Cinematic movie keyframe, ${effectiveStyle} animation style.${charNames ? ` Featuring characters: ${charNames}.` : ""} Scene: ${scene.name}. ${scene.description}. Location: ${scene.location || "unspecified"}.${charNames ? " Characters must maintain consistent appearance and design." : ""} Wide establishing shot, dramatic lighting, film composition.`;
      const result = await generateSceneImage(imagePrompt, apiKey, charRefs);
      if (folderHandle && projectId) {
        const imagesDir = await getProjectImagesDir(folderHandle, projectId);
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
        });
        await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
      } else {
        updateScene(id, {
          imageUrl: result.url,
          sourceUrl: result.url,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setImageRegenId(null);
    }
  };

  const handleRegenerateSceneDescription = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !apiKey) return;
    setError(null);
    setDescRegenId(id);
    try {
      const result = await regenerateSceneDescription(
        story,
        scene.name,
        scene.description,
        scene.conversations || [],
        apiKey,
        language,
      );
      updateScene(id, {
        name: result.name,
        description: result.description,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Description regeneration failed",
      );
    } finally {
      setDescRegenId(null);
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
        language,
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

  const handleRegenerateSceneLocation = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !apiKey) return;
    setError(null);
    setLocationRegenId(id);
    try {
      const location = await regenerateSceneLocation(
        scene.name,
        scene.description,
        apiKey,
        language,
      );
      updateScene(id, { location });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Location regeneration failed",
      );
    } finally {
      setLocationRegenId(null);
    }
  };

  const handleGeneratePptx = async () => {
    if (generatingPptx) return;
    setError(null);
    setGeneratingPptx(true);
    try {
      const blob = await generatePptx(story, characters, scenes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${story.slice(0, 30) || "movie"}-presentation.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PPTX generation failed");
    } finally {
      setGeneratingPptx(false);
    }
  };

  const handleExportZip = async () => {
    if (exportingZip || !folderHandle || !projectId) return;
    setError(null);
    setExportingZip(true);
    try {
      await exportProjectAsZip(
        folderHandle,
        projectId,
        folderName ?? "movie-project",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingZip(false);
    }
  };

  const getCharacterVideoFiles = async (
    referenceIds?: string[],
    charsOverride?: typeof characters,
  ): Promise<File[]> => {
    if (!folderHandle || !projectId) return [];
    const ids = new Set(referenceIds);
    const chars = charsOverride ?? characters;
    const files: File[] = [];
    try {
      const clipsDir = await getProjectClipsDir(folderHandle, projectId);
      for (const char of chars) {
        if (!char.videoFilename) continue;
        if (referenceIds && !ids.has(char.id)) continue;
        try {
          const fileHandle = await clipsDir.getFileHandle(char.videoFilename);
          files.push(await fileHandle.getFile());
        } catch {
          // file not found, skip
        }
      }
    } catch {
      // folder not accessible
    }
    return files;
  };

  const handleGenerateSceneVideo = async (id: string) => {
    if (!folderHandle || !apiKey || !projectId) return;
    // Reload latest data from disk so we use the freshest scenes and character videos
    let latestChars = characters;
    let latestScenes = scenes;
    try {
      const charsFromDisk = await readCharactersJson(folderHandle, projectId);
      if (charsFromDisk) latestChars = charsFromDisk;
      const scenesFromDisk = await readScenesJson(folderHandle, projectId);
      if (scenesFromDisk) latestScenes = scenesFromDisk;
    } catch {
      // fall back to in-memory data if disk read fails
    }
    const scene = latestScenes.find((s) => s.id === id);
    if (!scene?.imageFilename) return;
    setError(null);
    setGeneratingVideoId(id);
    try {
      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const sceneDirHandle = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const fileHandle = await sceneDirHandle.getFileHandle(scene.imageFilename);
      const file = await fileHandle.getFile();
      const dialogueLines = (scene.conversations || [])
        .map((c) => `${c.person} says: "${c.line}"`)
        .join("\n");
      const prompt = `Scene Title: ${scene.name}. \n\n

      Scene Description: ${scene.description}\n\nScene Location: ${scene.location || "unspecified"}\n\nDuration: ${scene.videoDuration}s.
      No background music. Language & Tone: ${language}.
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
        await getCharacterVideoFiles(
          (scene.videoReferenceIds?.length ?? 0)
            ? scene.videoReferenceIds!
            : undefined,
          latestChars,
        ),
      );
      const clipsDir = await getProjectClipsDir(folderHandle, projectId!);
      const videoFilename = `${crypto.randomUUID()}.mp4`;
      const localUrl = await saveAndLoadLocal(
        remoteUrl,
        videoFilename,
        clipsDir,
      );
      updateScene(id, { videoUrl: localUrl, videoFilename });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingVideoId(null);
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
    if (
      !selectedScenes.size ||
      isGenerating ||
      !apiKey ||
      !folderHandle ||
      !projectId
    )
      return;
    setError(null);
    setGeneratingSelectedImages(true);
    const total = selectedScenes.size;
    setSelectedProgress({ current: 0, total });
    try {
      // Reload latest data from disk so we use the freshest characters, scenes, and images
      let latestChars = characters;
      let latestScenes = scenes;
      try {
        const charsFromDisk = await readCharactersJson(folderHandle, projectId);
        if (charsFromDisk) latestChars = charsFromDisk;
        const scenesFromDisk = await readScenesJson(folderHandle, projectId);
        if (scenesFromDisk) latestScenes = scenesFromDisk;
      } catch {
        // fall back to in-memory data if disk read fails
      }
      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      let done = 0;
      await Promise.all(
        Array.from(selectedScenes).map(async (id) => {
          const scene = latestScenes.find((s) => s.id === id);
          if (!scene) return;
          // Only reference characters selected for this scene
          const sceneCharIds = new Set(scene.characterIds ?? []);
          const sceneChars =
            sceneCharIds.size > 0
              ? latestChars.filter((c) => sceneCharIds.has(c.id))
              : [];
          const charRefs = await resolveCharacterRefs(
            sceneChars,
            folderHandle,
            apiKey,
            projectId,
          );
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
          updateScene(id, {
            imageUrl: localUrl,
            imageFilename: filename,
            sourceUrl: result.url,
          });
          await savePromptFile(result.prompt, `${imageId}.txt`, sceneDir);
          done++;
          setSelectedProgress({ current: done, total });
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingSelectedImages(false);
      setSelectedProgress(null);
      setSelectedScenes(new Set());
    }
  };

  const handleGenerateSelectedVideos = async () => {
    if (
      !selectedScenes.size ||
      isGenerating ||
      !apiKey ||
      !folderHandle ||
      !projectId
    )
      return;
    setError(null);
    setGeneratingSelectedVideos(true);
    const total = selectedScenes.size;
    setSelectedProgress({ current: 0, total });
    try {
      // Reload latest data from disk so we use the freshest scenes and character videos
      let latestChars = characters;
      let latestScenes = scenes;
      try {
        const charsFromDisk = await readCharactersJson(folderHandle, projectId);
        if (charsFromDisk) latestChars = charsFromDisk;
        const scenesFromDisk = await readScenesJson(folderHandle, projectId);
        if (scenesFromDisk) latestScenes = scenesFromDisk;
      } catch {
        // fall back to in-memory data if disk read fails
      }
      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const clipsDir = await getProjectClipsDir(folderHandle, projectId);
      let done = 0;
      await Promise.all(
        Array.from(selectedScenes).map(async (id) => {
          const scene = latestScenes.find((s) => s.id === id);
          if (!scene?.imageFilename) return;
          const fileHandle = await sceneDir.getFileHandle(scene.imageFilename);
          const file = await fileHandle.getFile();
          const dialogueLines = (scene.conversations || [])
            .map((c) => `${c.person} says: "${c.line}"`)
            .join("\n");
          const prompt = `Scene Title: ${scene.name}. \n\n Scene Description: ${scene.description}\n\nScene Location: ${scene.location || "unspecified"}\n\n No background music.
        Language & Tone: ${language}.
        Must speak the dialogue lines.
        Must ignore the words in the attached video.
        The attached video is designed for tone reference. \n\n ${
          dialogueLines ? `\n\nDialogue lines:\n${dialogueLines}` : ""
        }`;
          const remoteUrl = await uploadAndGenerateVideo(
            file,
            prompt,
            apiKey,
            scene.videoResolution,
            scene.videoAspect,
            await getCharacterVideoFiles(
              (scene.videoReferenceIds?.length ?? 0)
                ? scene.videoReferenceIds!
                : undefined,
              latestChars,
            ),
          );
          const videoFilename = `${crypto.randomUUID()}.mp4`;
          const localUrl = await saveAndLoadLocal(
            remoteUrl,
            videoFilename,
            clipsDir,
          );
          updateScene(id, { videoUrl: localUrl, videoFilename });
          done++;
          setSelectedProgress({ current: done, total });
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGeneratingSelectedVideos(false);
      setSelectedProgress(null);
      setSelectedScenes(new Set());
    }
  };

  const handleGenerateSelectedScripts = async () => {
    if (!selectedScenes.size || isGenerating || !apiKey) return;
    setError(null);
    setGeneratingSelectedScripts(true);
    const total = selectedScenes.size;
    setSelectedProgress({ current: 0, total });
    try {
      let done = 0;
      await Promise.all(
        Array.from(selectedScenes).map(async (id) => {
          const scene = scenes.find((s) => s.id === id);
          if (!scene) return;
          const conversations = await regenerateSceneConversations(
            scene.name,
            scene.description,
            apiKey,
            language,
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
          done++;
          setSelectedProgress({ current: done, total });
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGeneratingSelectedScripts(false);
      setSelectedProgress(null);
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
      <ChatPanel />
      {isGenerating && (
        <div className="fixed top-[50px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm px-4 py-2 text-sm text-amber-200 shadow-lg shadow-amber-500/5">
          <svg
            className="w-4 h-4 shrink-0 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Generation in progress — please do not switch projects</span>
        </div>
      )}
      <div
        className={`transition-all duration-300 ${chatOpen ? "ml-[360px]" : ""}`}
      >
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-16">
          {/* Header */}
          <section className="relative text-center">
            <div className="absolute top-0 left-0">
              {aiProcessing ? (
                <div className="px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/50 text-neutral-400 text-xs">
                  AI is processing...
                </div>
              ) : (
                <ProjectSwitcher />
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="absolute top-0 right-0 p-2 text-neutral-500 hover:text-white transition-colors rounded-xl hover:bg-neutral-800"
              title="Settings"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
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
            <div className="flex justify-center mb-6">
              <div className="bg-white p-3 rounded-xl">
                <QRCode value={`https://agent.video.loklok.org`} size={200} />
              </div>

              {/* <div className="h-[256px] w-[256px] rotate-z-45">
              <Strands
                colors={["#d16d26", "#34a951", "#1a11be"]}
                count={3}
                speed={0.06}
                amplitude={0.5}
                waviness={2.5}
                thickness={0.5}
                glow={10}
                taper={1}
                spread={1}
                intensity={0.1}
                saturation={1.0}
                opacity={1}
                scale={1}
                glass
                refraction={3.141592}
                dispersion={0.0}
                glassSize={1}
                hueShift={0}
              ></Strands>
            </div> */}
            </div>
            <div className="text-blue-300 underline mb-3 font-bold">
              https://agent.video.loklok.org
            </div>
            <div className="text-white mb-3 font-bold">
              <a
                href={`https://github.com/wonglok/movie-loklok-org`}
                target="_blank"
              >
                Github
              </a>{" "}
              <a
                href={`https://www.linkedin.com/in/wonglok831`}
                target="_blank"
              >
                LinkedIn
              </a>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              AI Video Studio
            </h1>
            <p className="text-neutral-400 text-lg max-w-md mx-auto leading-relaxed">
              Bring your story to life with AI-generated characters and scenes
            </p>
            {isSaving && (
              <p className="text-neutral-100 text-xs mt-3 animate-pulse fixed top-3 left-3">
                Saving...
              </p>
            )}
          </section>

          {showSettings && (
            <SettingsModal
              folderName={folderName}
              pickerError={pickerError}
              apiKey={apiKey}
              onChangeFolder={handleChangeFolder}
              onSaveApiKey={saveApiKey}
              onClose={() => {
                setShowSettings(false);
                setPickerError(null);
              }}
            />
          )}

          <section>
            {aiProcessing ? (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800/60 border border-neutral-700/40 text-neutral-400 text-sm">
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>AI is processing — please wait</span>
                </div>
              </div>
            ) : (
              <div className="text-white">
                <ProjectTabs />
              </div>
            )}
          </section>

          {/* No Project State */}
          {hydrated && folderHandle && projects.length === 0 && (
            <section className="flex flex-col items-center gap-6 py-16">
              <div className="w-20 h-20 rounded-full bg-(--blender-accent)/10 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-(--blender-accent)"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Create Your First Project
              </h2>
              <p className="text-neutral-400 text-sm max-w-md text-center">
                A project contains your story, characters, scenes, and generated
                assets. You can create multiple projects in this workspace.
              </p>
              {creatingFirstProject ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={firstProjectName}
                    onChange={(e) => setFirstProjectName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (
                        e.key === "Enter" &&
                        firstProjectName.trim() &&
                        folderHandle
                      ) {
                        await createProject(
                          folderHandle,
                          firstProjectName.trim(),
                        );
                        await setActiveProjectId(
                          useProjectStore.getState().activeProjectId,
                        );
                        setFirstProjectName("");
                        setCreatingFirstProject(false);
                      }
                    }}
                    placeholder="My Movie Project"
                    autoFocus
                    className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors w-64"
                  />
                  <button
                    onClick={async () => {
                      if (!firstProjectName.trim() || !folderHandle) return;
                      await createProject(
                        folderHandle,
                        firstProjectName.trim(),
                      );
                      await setActiveProjectId(
                        useProjectStore.getState().activeProjectId,
                      );
                      setFirstProjectName("");
                      setCreatingFirstProject(false);
                    }}
                    disabled={!firstProjectName.trim()}
                    className="px-5 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Create
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreatingFirstProject(true)}
                  className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 transition-all"
                >
                  + New Project
                </button>
              )}
            </section>
          )}

          {/* Main content: only show when a project is active */}
          {hydrated &&
            (projects.length === 0 || activeProjectId) &&
            projects.length > 0 && (
              <>
                {removeTarget !== null && (
                  <RemoveConfirmModal
                    type={removeTarget.type}
                    name={
                      removeTarget.type === "character"
                        ? characters.find((c) => c.id === removeTarget.id)
                            ?.name || "this character"
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
                    <h2 className="text-xl font-semibold text-white">
                      Language
                    </h2>
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
                    <h2 className="text-xl font-semibold text-white">
                      Art Direction
                    </h2>
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
                {
                  <section className="flex flex-col items-center gap-4">
                    <button
                      onClick={handleExtractCharacters}
                      disabled={!story.trim() || isGenerating}
                      className="px-6 py-4 bg-white text-black rounded-2xl font-semibold text-base hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-3"
                    >
                      {extracting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400/30 border-t-cyan-400" />{" "}
                          <span className="text-cyan-400">
                            Extracting Characters...
                          </span>
                        </>
                      ) : (
                        "Extract Characters"
                      )}
                    </button>
                  </section>
                }

                {/* Character Cards */}
                {characters.length > 0 && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        &#x1F9D1;&#x200D;&#x1F3A4;
                      </span>
                      <h2 className="text-xl font-semibold text-white">
                        Characters
                      </h2>
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
                          regeneratingIds={regeneratingIds}
                          referenceVideoGeneratingIds={
                            referenceVideoGeneratingIds
                          }
                          onRegenerate={handleRegenerateCharacter}
                          onGenerateReferenceVideo={
                            handleGenerateReferenceVideo
                          }
                          onRemove={(id) =>
                            setRemoveTarget({ id, type: "character" })
                          }
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
                              location: "",
                              imageUrl: null,
                              imageFilename: null,
                              sourceUrl: null,
                              videoUrl: null,
                              videoFilename: null,
                              videoDuration: 5,
                              videoResolution: "480p",
                              videoAspect: "9:16",
                              videoReferenceIds: [],
                              characterIds: [],
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
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400/30 border-t-cyan-400" />{" "}
                            <span className="text-cyan-400">Generating...</span>
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
                      <h2 className="text-xl font-semibold text-white">
                        Scenes
                      </h2>
                      {scenes.length > 0 && (
                        <span className="text-sm text-neutral-500">
                          {scenes.length}{" "}
                          {scenes.length === 1 ? "scene" : "scenes"}
                        </span>
                      )}
                      {scenes.length > 0 && (
                        <button
                          onClick={() =>
                            setSelectedScenes(
                              selectedScenes.size === scenes.length
                                ? new Set()
                                : new Set(scenes.map((s) => s.id)),
                            )
                          }
                          className="ml-auto px-3 py-1 border bg-white border-neutral-700 rounded-lg text-black text-xs hover:border-black/50 hover:text-neutral-200 transition-colors"
                        >
                          {selectedScenes.size === scenes.length
                            ? "Deselect All"
                            : "Select All"}
                        </button>
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
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400/30 border-t-cyan-400" />{" "}
                              <span className="text-cyan-400">
                                Extracting Scenes...
                              </span>
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
                            <span className="text-neutral-400 text-sm flex-1 flex items-center gap-2">
                              {selectedScenes.size} scene
                              {selectedScenes.size > 1 ? "s" : ""} selected
                              {selectedProgress !== null && (
                                <span className="inline-flex items-center gap-1.5 text-cyan-400">
                                  <div className="animate-spin rounded-full h-3 w-3 border border-cyan-400/30 border-t-cyan-400" />
                                  {selectedProgress.current}/
                                  {selectedProgress.total}
                                </span>
                              )}
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
                              {generatingSelectedImages ? (
                                <span className="text-cyan-400">
                                  Generating...
                                </span>
                              ) : (
                                "Generate Selected Images"
                              )}
                            </button>

                            <button
                              onClick={handleGenerateSelectedVideos}
                              disabled={
                                isGenerating || generatingSelectedVideos
                              }
                              className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              {generatingSelectedVideos ? (
                                <span className="text-cyan-400">
                                  Generating...
                                </span>
                              ) : (
                                "Generate Selected Videos"
                              )}
                            </button>

                            <button
                              onClick={handleGenerateSelectedScripts}
                              disabled={isGenerating}
                              className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              {generatingSelectedScripts ? (
                                <span className="text-cyan-400">
                                  Generating...
                                </span>
                              ) : (
                                "Generate Selected Scripts"
                              )}
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
                              imageRegenId={imageRegenId}
                              descRegenId={descRegenId}
                              scriptRegenId={scriptRegenId}
                              locationRegenId={locationRegenId}
                              generatingVideoId={generatingVideoId}
                              selected={selectedScenes.has(scene.id)}
                              onToggleSelect={toggleSceneSelect}
                              onRegenerateImage={handleRegenerateSceneImage}
                              onRegenerateDescription={
                                handleRegenerateSceneDescription
                              }
                              onRegenerateScript={handleRegenerateSceneScript}
                              onRegenerateLocation={
                                handleRegenerateSceneLocation
                              }
                              onGenerateVideo={handleGenerateSceneVideo}
                              onRemove={(id) =>
                                setRemoveTarget({ id, type: "scene" })
                              }
                              onPreview={(id) => {
                                setPreviewId(id);
                                setPreviewType("scene");
                              }}
                              folderHandle={folderHandle}
                              updateScene={updateScene}
                              availableReferences={characters
                                .filter((c) => c.videoFilename)
                                .map((c) => ({ id: c.id, name: c.name }))}
                              availableCharacters={characters
                                .filter((c) => c.name)
                                .map((c) => ({
                                  id: c.id,
                                  name: c.name,
                                  hasImage: !!c.imageFilename,
                                }))}
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
                                  location: "",
                                  imageUrl: null,
                                  imageFilename: null,
                                  sourceUrl: null,
                                  videoUrl: null,
                                  videoFilename: null,
                                  videoDuration: 5,
                                  videoResolution: "480p",
                                  videoAspect: "9:16",
                                  videoReferenceIds: [],
                                  characterIds: [],
                                  conversations: [],
                                },
                              ])
                            }
                            className="px-4 py-2 border border-dashed border-neutral-700 rounded-xl text-neutral-500 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            + Add Scene
                          </button>
                          {!hasCharacterImages && (
                            <p className="text-amber-400 text-xs">
                              Generate character images first to reference them
                              in scenes.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {/* Movie Editor Section */}
                {folderHandle && (
                  <MovieEditor
                    scenes={scenes}
                    folderHandle={folderHandle}
                    updateScene={updateScene}
                  />
                )}

                {/* Export Section */}
                {folderHandle && (
                  <section className="flex flex-col items-start gap-2">
                    <h2 className="text-xl font-semibold text-white mb-3">
                      <span className="text-2xl mr-2">&#x1F4E6;</span>
                      Export Project
                    </h2>
                    <p className="text-neutral-500 text-sm mb-1">
                      Download all project files as a zip archive to share or
                      back up your work.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleExportZip}
                        disabled={exportingZip}
                        className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {exportingZip ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />
                            Exporting...
                          </>
                        ) : (
                          <>
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
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                              />
                            </svg>
                            Export Project as ZIP
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!folderHandle) return;
                          await importProject(folderHandle);
                          await setActiveProjectId(
                            useProjectStore.getState().activeProjectId,
                          );
                        }}
                        className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 7.5m0 0l4.5 4.5M12 7.5V21"
                          />
                        </svg>
                        Import New Project from ZIP File
                      </button>
                    </div>
                  </section>
                )}

                {/* eBook Section */}
                {(characters.length > 0 || scenes.length > 0) && (
                  <section className="flex flex-col items-start gap-2">
                    <h2 className="text-xl font-semibold text-white mb-3">
                      <span className="text-2xl mr-2">&#x1F4D6;</span>
                      eBook
                    </h2>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleGeneratePptx}
                        disabled={generatingPptx}
                        className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {generatingPptx ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400/30 border-t-cyan-400" />
                            <span className="text-cyan-400">
                              Generating PPTX...
                            </span>
                          </>
                        ) : (
                          <>
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
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                              />
                            </svg>
                            Download PPTX
                          </>
                        )}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
        </div>
        <AgentProgressPanel />
      </div>
    </div>
  );
}
