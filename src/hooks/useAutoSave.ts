import { useState, useEffect, useRef } from "react";
import type { Character, Moment } from "@/stores/movie-store";
import {
  writeMovieJson,
  writeCharactersJson,
  writeScenesJson,
  writeMomentsJson,
} from "@/lib/fs-helpers";

export function useAutoSave(
  folderHandle: FileSystemDirectoryHandle | null,
  hydrated: boolean,
  story: string,
  artStyle: string,
  customArtStyle: string,
  characters: Character[],
  scenes: Character[],
  moments: Moment[],
) {
  const [isSaving, setIsSaving] = useState(false);

  const movieDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const momentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (movieDebounceRef.current) clearTimeout(movieDebounceRef.current);
    setIsSaving(true);
    movieDebounceRef.current = setTimeout(() => {
      writeMovieJson(folderHandle, {
        story,
        artStyle,
        customArtStyle,
      })
        .catch(() => {})
        .finally(() => setIsSaving(false));
    }, 500);
  }, [story, artStyle, customArtStyle, hydrated, folderHandle]);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (charDebounceRef.current) clearTimeout(charDebounceRef.current);
    charDebounceRef.current = setTimeout(() => {
      writeCharactersJson(folderHandle, characters).catch(() => {});
    }, 500);
  }, [characters, hydrated, folderHandle]);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (sceneDebounceRef.current) clearTimeout(sceneDebounceRef.current);
    sceneDebounceRef.current = setTimeout(() => {
      writeScenesJson(folderHandle, scenes).catch(() => {});
    }, 500);
  }, [scenes, hydrated, folderHandle]);

  useEffect(() => {
    if (!hydrated || !folderHandle) return;

    if (momentDebounceRef.current) clearTimeout(momentDebounceRef.current);
    momentDebounceRef.current = setTimeout(() => {
      writeMomentsJson(folderHandle, moments).catch(() => {});
    }, 500);
  }, [moments, hydrated, folderHandle]);

  return { isSaving };
}
