import { create } from "zustand";
import localforage from "localforage";

const API_KEY_STORAGE_KEY = "fal-api-key";

function opfsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "storage" in navigator && "getDirectory" in navigator.storage;
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!opfsSupported()) return null;
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

interface FolderState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  apiKey: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  saveApiKey: (key: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearData: () => Promise<void>;
}

export const useFolderStore = create<FolderState>((set) => ({
  folderHandle: null,
  folderName: null,
  apiKey: null,
  isConfigured: false,
  isLoading: true,
  error: null,

  saveApiKey: async (key: string) => {
    try {
      await localforage.setItem(API_KEY_STORAGE_KEY, key.trim());
      set({ apiKey: key.trim(), isConfigured: true, error: null });
    } catch {
      set({ error: "Failed to save API key" });
    }
  },

  loadFromStorage: async () => {
    try {
      const [root, storedKey] = await Promise.all([
        getOpfsRoot(),
        localforage.getItem<string>(API_KEY_STORAGE_KEY),
      ]);

      if (!root) {
        set({
          isLoading: false,
          error: "OPFS is not supported in this browser",
        });
        return;
      }

      set({
        folderHandle: root,
        folderName: "Movie Project",
        apiKey: storedKey,
        isConfigured: !!storedKey,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: "Failed to load storage" });
    }
  },

  clearData: async () => {
    const root = await getOpfsRoot();
    if (root) {
      try {
        // Remove known subdirectories and files
        for (const name of [
          "movie.json",
          "character.json",
          "scene.json",
          "video.json",
          "moments.json",
        ]) {
          try {
            await root.removeEntry(name);
          } catch {
            // file doesn't exist, ignore
          }
        }
        for (const dir of ["images", "clips"]) {
          try {
            await root.removeEntry(dir, { recursive: true });
          } catch {
            // dir doesn't exist, ignore
          }
        }
      } catch {
        // best-effort cleanup
      }
    }
    await localforage.removeItem(API_KEY_STORAGE_KEY);
    set({
      folderHandle: root,
      folderName: root ? "Movie Project" : null,
      apiKey: null,
      isConfigured: false,
      error: null,
    });
  },
}));
