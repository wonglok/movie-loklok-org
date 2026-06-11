import { create } from "zustand";
import localforage from "localforage";

const FOLDER_HANDLE_KEY = "fal-folder-handle";
const KEY_FILENAME = "api-keys.json";

interface FolderState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
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
      const fileHandle = await handle.getFileHandle(KEY_FILENAME, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(
        JSON.stringify({ fal: { apiKey: key.trim() } }, null, 2),
      );
      await writable.close();

      await localforage.setItem(FOLDER_HANDLE_KEY, handle);
      set({ isConfigured: true, error: null });
    } catch {
      set({ error: "Failed to save API key to folder" });
    }
  },

  loadFromStorage: async () => {
    try {
      const handle =
        await localforage.getItem<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY);

      if (!handle) {
        set({ isLoading: false });
        return;
      }

      const permission = await handle.queryPermission({ mode: "readwrite" });

      if (permission === "granted") {
        set({
          folderHandle: handle,
          folderName: handle.name,
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
            isConfigured: true,
            isLoading: false,
          });
          return;
        }
      }

      // Permission denied — clear stale handle
      await localforage.removeItem(FOLDER_HANDLE_KEY);
      set({ isLoading: false });
    } catch {
      set({ isLoading: false, error: "Failed to load stored folder" });
    }
  },

  clearFolder: async () => {
    await localforage.removeItem(FOLDER_HANDLE_KEY);
    set({
      folderHandle: null,
      folderName: null,
      isConfigured: false,
      error: null,
    });
  },
}));
