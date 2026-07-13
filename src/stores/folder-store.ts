import { create } from "zustand";
import localforage from "localforage";

const FOLDER_HANDLE_KEY = "fal-folder-handle";
const API_KEY_STORAGE_KEY = "fal-api-key";
const ACTIVE_PROJECT_KEY = "fal-active-project";

interface FolderState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  apiKey: string | null;
  activeProjectId: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  setFolder: (handle: FileSystemDirectoryHandle) => void;
  saveApiKey: (key: string) => Promise<void>;
  setActiveProjectId: (id: string | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearFolder: () => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folderHandle: null,
  folderName: null,
  apiKey: null,
  activeProjectId: null,
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

  setActiveProjectId: async (id: string | null) => {
    if (id) {
      await localforage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
      await localforage.removeItem(ACTIVE_PROJECT_KEY);
    }
    set({ activeProjectId: id });
  },

  loadFromStorage: async () => {
    try {
      const [handle, storedKey, storedProjectId] = await Promise.all([
        localforage.getItem<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY),
        localforage.getItem<string>(API_KEY_STORAGE_KEY),
        localforage.getItem<string>(ACTIVE_PROJECT_KEY),
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
          activeProjectId: storedProjectId ?? null,
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
            activeProjectId: storedProjectId ?? null,
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
        localforage.removeItem(ACTIVE_PROJECT_KEY),
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
      localforage.removeItem(ACTIVE_PROJECT_KEY),
    ]);
    set({
      folderHandle: null,
      folderName: null,
      apiKey: null,
      activeProjectId: null,
      isConfigured: false,
      error: null,
    });
  },
}));
