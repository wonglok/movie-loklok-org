import { create } from "zustand";
import localforage from "localforage";

const FOLDER_HANDLE_KEY = "fal-folder-handle";
const API_KEY_STORAGE_KEY = "fal-api-key";

interface FolderState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  apiKey: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  setFolder: (handle: FileSystemDirectoryHandle) => void;
  saveApiKey: (key: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearFolder: () => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folderHandle: null,
  folderName: null,
  apiKey: null,
  isConfigured: false,
  isLoading: true,
  error: null,

  setFolder: (handle: FileSystemDirectoryHandle) => {
    set({
      folderHandle: handle,
      folderName: handle.name,
      error: null,
    });
  },

  saveApiKey: async (key: string) => {
    const handle = get().folderHandle;
    if (!handle) {
      set({ error: "No folder selected" });
      return;
    }

    try {
      await localforage.setItem(API_KEY_STORAGE_KEY, key.trim());
      await localforage.setItem(FOLDER_HANDLE_KEY, handle);
      set({ apiKey: key.trim(), isConfigured: true, error: null });
    } catch {
      set({ error: "Failed to save API key" });
    }
  },

  loadFromStorage: async () => {
    try {
      const [handle, storedKey] = await Promise.all([
        localforage.getItem<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY),
        localforage.getItem<string>(API_KEY_STORAGE_KEY),
      ]);

      if (!handle || !storedKey) {
        set({ isLoading: false });
        return;
      }

      const permission = await handle.queryPermission({ mode: "readwrite" });

      if (permission === "granted") {
        set({
          folderHandle: handle,
          folderName: handle.name,
          apiKey: storedKey,
          isConfigured: true,
          isLoading: false,
        });
        return;
      }

      if (permission === "prompt") {
        const newPermission = await handle.requestPermission({
          mode: "readwrite",
        });
        if (newPermission === "granted") {
          set({
            folderHandle: handle,
            folderName: handle.name,
            apiKey: storedKey,
            isConfigured: true,
            isLoading: false,
          });
          return;
        }
      }

      // Permission denied — clear stale data
      await Promise.all([
        localforage.removeItem(FOLDER_HANDLE_KEY),
        localforage.removeItem(API_KEY_STORAGE_KEY),
      ]);
      set({ isLoading: false });
    } catch {
      set({ isLoading: false, error: "Failed to load stored data" });
    }
  },

  clearFolder: async () => {
    await Promise.all([
      localforage.removeItem(FOLDER_HANDLE_KEY),
      localforage.removeItem(API_KEY_STORAGE_KEY),
    ]);
    set({
      folderHandle: null,
      folderName: null,
      apiKey: null,
      isConfigured: false,
      error: null,
    });
  },
}));
