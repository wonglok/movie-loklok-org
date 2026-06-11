import { useEffect } from "react";
import type { Character } from "@/stores/movie-store";
import { loadLocalImage } from "@/lib/fs-helpers";

export function useLocalImages(
  folderHandle: FileSystemDirectoryHandle | null,
  hydrated: boolean,
  characters: Character[],
  scenes: Character[],
  updateCharacter: (id: string, u: Partial<Character>) => void,
  updateScene: (id: string, u: Partial<Character>) => void,
) {
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

        for (const char of characters) {
          if (char.imageFilename) {
            const localUrl = await loadLocalImage(
              char.imageFilename,
              characterDir,
            );
            if (localUrl) {
              if (char.imageUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(char.imageUrl);
              }
              updateCharacter(char.id, { imageUrl: localUrl });
            }
          }
        }

        for (const scene of scenes) {
          if (scene.imageFilename) {
            const localUrl = await loadLocalImage(
              scene.imageFilename,
              sceneDir,
            );
            if (localUrl) {
              if (scene.imageUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(scene.imageUrl);
              }
              updateScene(scene.id, { imageUrl: localUrl });
            }
          }
        }
      } catch {
        // folder not ready, ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
}
