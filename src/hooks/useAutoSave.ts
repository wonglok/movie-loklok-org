import { useState, useEffect, useRef } from "react";
import type { Character } from "@/stores/movie-store";
import {
  writeMovieJson,
  writeCharactersJson,
  writeScenesJson,
} from "@/lib/fs-helpers";

export function useAutoSave(
  folderHandle: FileSystemDirectoryHandle | null,
  projectId: string | null,
  hydrated: boolean,
  story: string,
  artStyle: string,
  customArtStyle: string,
  language: string,
  characters: Character[],
  scenes: Character[],
) {
  const [isSaving, setIsSaving] = useState(false);

  const movieDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || !folderHandle || !projectId) return;

    if (movieDebounceRef.current) clearTimeout(movieDebounceRef.current);
    setIsSaving(true);
    movieDebounceRef.current = setTimeout(() => {
      writeMovieJson(folderHandle, projectId, {
        story,
        artStyle,
        customArtStyle,
        language,
      })
        .catch(() => {})
        .finally(() => setIsSaving(false));
    }, 500);
  }, [story, artStyle, customArtStyle, language, hydrated, folderHandle, projectId]);

  useEffect(() => {
    if (!hydrated || !folderHandle || !projectId) return;

    if (charDebounceRef.current) clearTimeout(charDebounceRef.current);
    charDebounceRef.current = setTimeout(() => {
      writeCharactersJson(folderHandle, projectId, characters).catch(() => {});
    }, 500);
  }, [characters, hydrated, folderHandle, projectId]);

  useEffect(() => {
    if (!hydrated || !folderHandle || !projectId) return;

    if (sceneDebounceRef.current) clearTimeout(sceneDebounceRef.current);
    sceneDebounceRef.current = setTimeout(() => {
      writeScenesJson(folderHandle, projectId, scenes).catch(() => {});
    }, 500);
  }, [scenes, hydrated, folderHandle, projectId]);

  return { isSaving };
}
