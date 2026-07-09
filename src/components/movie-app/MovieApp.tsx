"use client";

import { useState, useEffect, useRef } from "react";
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
  regenerateSceneDescription,
  regenerateSceneLocation,
} from "@/lib/fal";
import { resolveStyle } from "@/lib/style";
import {
  readMovieJson,
  readCharactersJson,
  readScenesJson,
  readVideoJson,
  readMomentsJson,
  saveAndLoadLocal,
  savePromptFile,
  loadLocalImage,
  exportProjectAsZip,
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
import QRCode from "react-qr-code";
// import Strands from "../backgrounds/Strands";

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
  const setMoments = useMovieStore((s) => s.setMoments);
  const setVideoInfo = useMovieStore((s) => s.setVideoInfo);
  const resetMovieState = useMovieStore((s) => s.resetState);
  const apiKey = useFolderStore((s) => s.apiKey);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const folderName = useFolderStore((s) => s.folderName);
  const saveApiKey = useFolderStore((s) => s.saveApiKey);
  const projects = useFolderStore((s) => s.projects);
  const activeProjectId = useFolderStore((s) => s.activeProjectId);
  const createProject = useFolderStore((s) => s.createProject);
  const switchProject = useFolderStore((s) => s.switchProject);
  const deleteProject = useFolderStore((s) => s.deleteProject);
  const renameProject = useFolderStore((s) => s.renameProject);

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
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showRenameProjectModal, setShowRenameProjectModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  const [isProjectSwitching, setIsProjectSwitching] = useState(false);

  const hydrationProjectRef = useRef<string | null>(null);

  // Reset hydrated when folderHandle changes so auto-save pauses during switch
  useEffect(() => {
    if (folderHandle) {
      setHydrated(false);
    }
  }, [folderHandle]);

  const isGenerating =
    generatingCharacters ||
    generatingSelectedImages ||
    extracting ||
    extractingScenes ||
    generatingSelectedVideos ||
    generatingSelectedScripts ||
    selectedProgress !== null;
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
        if (char.videoUrl) URL.revokeObjectURL(char.videoUrl);
      }
      for (const scene of scenes) {
        if (scene.imageUrl) URL.revokeObjectURL(scene.imageUrl);
        if (scene.videoUrl) URL.revokeObjectURL(scene.videoUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted state on mount or project switch
  useEffect(() => {
    if (!folderHandle) {
      setHydrated(true);
      return;
    }

    const projectId = activeProjectId;
    hydrationProjectRef.current = projectId;

    (async () => {
      try {
        const [movieData, charData, sceneData, videoData, momentsData] =
          await Promise.all([
            readMovieJson(folderHandle),
            readCharactersJson(folderHandle),
            readScenesJson(folderHandle),
            readVideoJson(folderHandle),
            readMomentsJson(folderHandle),
          ]);

        // Discard stale hydration if user switched projects again
        if (hydrationProjectRef.current !== projectId) return;

        if (movieData) {
          setStory(movieData.story ?? "");
          if (
            movieData.artStyle &&
            ART_STYLES.some((s) => s.key === movieData.artStyle)
          )
            setArtStyle(movieData.artStyle as ArtStyle);
          else
            setArtStyle("cartoon-3d");
          setCustomArtStyle(movieData.customArtStyle ?? "");
          setLanguage(movieData.language ?? "English");
        } else {
          setStory("");
          setArtStyle("cartoon-3d");
          setCustomArtStyle("");
          setLanguage("English");
        }
        setCharacters(charData ?? []);
        setScenes(sceneData ?? []);
        setMoments(momentsData ?? []);
        setVideoInfo(videoData ?? null);
      } catch {
        // use defaults (already applied)
      } finally {
        if (hydrationProjectRef.current === projectId) {
          setHydrated(true);
        }
      }
    })();
  }, [
    folderHandle,
    activeProjectId,
    setStory,
    setArtStyle,
    setCustomArtStyle,
    setLanguage,
    setCharacters,
    setScenes,
    setMoments,
    setVideoInfo,
  ]);

  // Load videos from workspace clips/ folder
  useEffect(() => {
    if (!hydrated || !folderHandle) return;
    (async () => {
      try {
        const clipsDir = await folderHandle.getDirectoryHandle("clips", {
          create: true,
        });
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
  }, [hydrated]);

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
    if (!characters.length || isGenerating || !apiKey || !folderHandle) return;
    setError(null);

    setGeneratingCharacters(true);
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const characterDir = await imagesDir.getDirectoryHandle("character", {
        create: true,
      });
      await Promise.all(
        characters.map(async (char) => {
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
    const char = characters.find((c) => c.id === id);
    if (!char || !apiKey) return;
    setError(null);
    setRegeneratingIds((prev) => new Set(prev).add(id));
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
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGenerateReferenceVideo = async (id: string) => {
    const char = characters.find((c) => c.id === id);
    if (!char?.imageFilename || !folderHandle || !apiKey) return;
    setError(null);
    setReferenceVideoGeneratingIds((prev) => new Set(prev).add(id));
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
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
      const clipsDir = await folderHandle.getDirectoryHandle("clips", {
        create: true,
      });
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
      const extracted = await extractScenes(story, apiKey, language);
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
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !apiKey) return;
    setError(null);
    setImageRegenId(id);
    try {
      const charRefs = await resolveCharacterRefs(
        characters,
        folderHandle,
        apiKey,
      );
      const charNames = characters
        .filter((c) => c.name)
        .map((c) => c.name)
        .join(", ");
      const imagePrompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Featuring characters: ${charNames || "original characters"}. Scene: ${scene.name}. ${scene.description}. Location: ${scene.location || "unspecified"}. Characters must maintain consistent appearance and design. Wide establishing shot, dramatic lighting, film composition.`;
      const result = await generateSceneImage(imagePrompt, apiKey, charRefs);
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
    if (exportingZip || !folderHandle) return;
    setError(null);
    setExportingZip(true);
    try {
      await exportProjectAsZip(folderHandle, folderName ?? "movie-project");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Export failed",
      );
    } finally {
      setExportingZip(false);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    if (projectId === activeProjectId || isProjectSwitching) return;
    setIsProjectSwitching(true);
    setProjectMenuOpen(false);
    try {
      resetMovieState();
      await switchProject(projectId);
    } catch {
      setError("Failed to switch project");
    } finally {
      setIsProjectSwitching(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectNameInput.trim()) return;
    setShowNewProjectModal(false);
    setIsProjectSwitching(true);
    try {
      resetMovieState();
      await createProject(projectNameInput.trim());
    } catch {
      setError("Failed to create project");
    } finally {
      setProjectNameInput("");
      setIsProjectSwitching(false);
    }
  };

  const handleRenameProject = async () => {
    if (!projectNameInput.trim() || !activeProjectId) return;
    setShowRenameProjectModal(false);
    try {
      await renameProject(activeProjectId, projectNameInput.trim());
    } catch {
      setError("Failed to rename project");
    } finally {
      setProjectNameInput("");
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProjectId) return;
    setShowDeleteProjectModal(false);
    setIsProjectSwitching(true);
    try {
      resetMovieState();
      await deleteProject(activeProjectId);
    } catch {
      setError("Failed to delete project");
    } finally {
      setIsProjectSwitching(false);
    }
  };

  const getCharacterVideoFiles = async (
    referenceIds?: string[],
  ): Promise<File[]> => {
    if (!folderHandle) return [];
    const ids = new Set(referenceIds);
    const files: File[] = [];
    try {
      const clipsDir = await folderHandle.getDirectoryHandle("clips", {
        create: true,
      });
      for (const char of characters) {
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
        ),
      );
      const clipsDir = await folderHandle.getDirectoryHandle("clips", {
        create: true,
      });
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
    if (!selectedScenes.size || isGenerating || !apiKey || !folderHandle)
      return;
    setError(null);
    setGeneratingSelectedImages(true);
    const total = selectedScenes.size;
    setSelectedProgress({ current: 0, total });
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
      let done = 0;
      await Promise.all(
        Array.from(selectedScenes).map(async (id) => {
          const scene = scenes.find((s) => s.id === id);
          if (!scene) return;
          const prompt = `Cinematic movie keyframe, ${effectiveStyle} animation style. Featuring characters: ${charNames || "original characters"}. Scene: ${scene.name}. ${scene.description}. Location: ${scene.location || "unspecified"}. Characters must maintain consistent appearance and design. Wide establishing shot, dramatic lighting, film composition.`;
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
    if (!selectedScenes.size || isGenerating || !apiKey || !folderHandle)
      return;
    setError(null);
    setGeneratingSelectedVideos(true);
    const total = selectedScenes.size;
    setSelectedProgress({ current: 0, total });
    try {
      const imagesDir = await folderHandle.getDirectoryHandle("images", {
        create: true,
      });
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const clipsDir = await folderHandle.getDirectoryHandle("clips", {
        create: true,
      });
      let done = 0;
      await Promise.all(
        Array.from(selectedScenes).map(async (id) => {
          const scene = scenes.find((s) => s.id === id);
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
      {/* {isGenerating && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 mt-3 px-5 py-2 bg-orange-500/90 backdrop-blur-sm text-white text-sm font-semibold rounded-full shadow-lg shadow-orange-500/20 animate-pulse">
          Generation in progress, do not refresh.
        </div>
      )} */}
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
          {/* Project Selector */}
          <div className="relative mb-6">
            <button
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium hover:bg-neutral-700 transition-colors mx-auto"
            >
              <span className="truncate max-w-[200px]">
                {folderName || "Untitled"}
              </span>
              <svg
                className="w-4 h-4 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            {projectMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl z-50 py-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchProject(p.id)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-neutral-800 transition-colors ${
                      p.id === activeProjectId
                        ? "text-white font-medium"
                        : "text-neutral-400"
                    }`}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.id === activeProjectId && (
                      <span className="text-xs text-(--blender-accent)">
                        Active
                      </span>
                    )}
                  </button>
                ))}
                <div className="border-t border-neutral-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setProjectMenuOpen(false);
                      setProjectNameInput("");
                      setShowNewProjectModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-neutral-800 transition-colors"
                  >
                    + New Project
                  </button>
                  <button
                    onClick={() => {
                      setProjectMenuOpen(false);
                      setProjectNameInput(folderName ?? "");
                      setShowRenameProjectModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 transition-colors"
                  >
                    Rename Project
                  </button>
                  <button
                    onClick={() => {
                      setProjectMenuOpen(false);
                      setShowDeleteProjectModal(true);
                    }}
                    disabled={projects.length <= 1}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center mb-6">
            <div className="bg-white p-3 rounded-xl">
              <QRCode
                value={`https://github.com/wonglok/movie-loklok-org`}
                size={350}
              />
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

            {/*
             */}
          </div>
          <div className="text-white mb-3 font-bold">VIDEO.LOKLOK.ORG</div>
          <div className="text-white mb-3 font-bold">
            <a
              href={`https://github.com/wonglok/movie-loklok-org`}
              target="_blank"
            >
              Github
            </a>{" "}
            <a href={`https://www.linkedin.com/in/wonglok831`} target="_blank">
              LinkedIn
            </a>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Simple Movie Studio
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
            apiKey={apiKey}
            onSaveApiKey={saveApiKey}
            onClose={() => {
              setShowSettings(false);
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

        {/* Project Delete Confirmation */}
        {showDeleteProjectModal && (
          <RemoveConfirmModal
            type="project"
            name={folderName ?? "this project"}
            onConfirm={handleDeleteProject}
            onCancel={() => setShowDeleteProjectModal(false)}
          />
        )}

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                New Project
              </h2>
              <p className="text-neutral-400 text-sm mb-6">
                Enter a name for the new project.
              </p>
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                }}
                placeholder="Project name..."
                autoFocus
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectNameInput.trim()}
                  className="flex-1 px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Project Modal */}
        {showRenameProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold text-white mb-2">
                Rename Project
              </h2>
              <p className="text-neutral-400 text-sm mb-6">
                Enter a new name for this project.
              </p>
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameProject();
                }}
                placeholder="Project name..."
                autoFocus
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRenameProjectModal(false)}
                  className="flex-1 px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameProject}
                  disabled={!projectNameInput.trim()}
                  className="flex-1 px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
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
                  regeneratingIds={regeneratingIds}
                  referenceVideoGeneratingIds={referenceVideoGeneratingIds}
                  onRegenerate={handleRegenerateCharacter}
                  onGenerateReferenceVideo={handleGenerateReferenceVideo}
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
              <h2 className="text-xl font-semibold text-white">Scenes</h2>
              {scenes.length > 0 && (
                <span className="text-sm text-neutral-500">
                  {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
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
                          {selectedProgress.current}/{selectedProgress.total}
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
                        <span className="text-cyan-400">Generating...</span>
                      ) : (
                        "Generate Selected Images"
                      )}
                    </button>

                    <button
                      onClick={handleGenerateSelectedVideos}
                      disabled={isGenerating || generatingSelectedVideos}
                      className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {generatingSelectedVideos ? (
                        <span className="text-cyan-400">Generating...</span>
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
                        <span className="text-cyan-400">Generating...</span>
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
                      onRegenerateDescription={handleRegenerateSceneDescription}
                      onRegenerateScript={handleRegenerateSceneScript}
                      onRegenerateLocation={handleRegenerateSceneLocation}
                      onGenerateVideo={handleGenerateSceneVideo}
                      onRemove={(id) => setRemoveTarget({ id, type: "scene" })}
                      onPreview={(id) => {
                        setPreviewId(id);
                        setPreviewType("scene");
                      }}
                      folderHandle={folderHandle}
                      updateScene={updateScene}
                      availableReferences={characters
                        .filter((c) => c.videoFilename)
                        .map((c) => ({ id: c.id, name: c.name }))}
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
                      Generate character images first to reference them in
                      scenes.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* Movie Editor Section */}
        <MovieEditor
          scenes={scenes}
          folderHandle={folderHandle}
          updateScene={updateScene}
        />

        {/* Export Section */}
        {folderHandle && (
          <section className="flex flex-col items-start gap-2">
            <h2 className="text-xl font-semibold text-white mb-3">
              <span className="text-2xl mr-2">&#x1F4E6;</span>
              Export Project
            </h2>
            <p className="text-neutral-500 text-sm mb-1">
              Download all project files as a zip archive to share or back up
              your work.
            </p>
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
                  Export & Download ZIP
                </>
              )}
            </button>
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
                    <span className="text-cyan-400">Generating PPTX...</span>
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
      </div>
    </div>
  );
}
