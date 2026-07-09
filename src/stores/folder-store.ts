import { create } from "zustand";
import localforage from "localforage";
import {
  type ProjectMeta,
  type ProjectsIndex,
  readProjectsIndex,
  writeProjectsIndex,
  getProjectDirectory,
  removeProjectDirectory,
} from "@/lib/fs-helpers";

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

async function hasRootFiles(root: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await root.getFileHandle("movie.json");
    return true;
  } catch {
    return false;
  }
}

async function copyDirectoryContents(
  srcDir: FileSystemDirectoryHandle,
  dstDir: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of srcDir.entries()) {
    if (handle.kind === "file") {
      const file = await handle.getFile();
      const dstHandle = await dstDir.getFileHandle(name, { create: true });
      const writable = await dstHandle.createWritable();
      await writable.write(file);
      await writable.close();
    } else if (handle.kind === "directory") {
      const subSrc = await srcDir.getDirectoryHandle(name);
      const subDst = await dstDir.getDirectoryHandle(name, { create: true });
      await copyDirectoryContents(subSrc, subDst);
    }
  }
}

async function migrateLegacyProject(
  root: FileSystemDirectoryHandle,
): Promise<ProjectMeta | null> {
  const hasData = await hasRootFiles(root);
  if (!hasData) return null;

  const legacyId = crypto.randomUUID();
  const projDir = await getProjectDirectory(root, legacyId);

  const filesToMigrate = [
    "movie.json",
    "character.json",
    "scene.json",
    "video.json",
    "moments.json",
  ];

  for (const filename of filesToMigrate) {
    try {
      const srcHandle = await root.getFileHandle(filename);
      const file = await srcHandle.getFile();
      const contents = await file.text();
      const dstHandle = await projDir.getFileHandle(filename, { create: true });
      const writable = await dstHandle.createWritable();
      await writable.write(contents);
      await writable.close();
      await root.removeEntry(filename);
    } catch {
      // file didn't exist at root, skip
    }
  }

  for (const dirName of ["images", "clips"]) {
    try {
      const srcDir = await root.getDirectoryHandle(dirName);
      const dstDir = await projDir.getDirectoryHandle(dirName, { create: true });
      await copyDirectoryContents(srcDir, dstDir);
      await root.removeEntry(dirName, { recursive: true });
    } catch {
      // directory doesn't exist
    }
  }

  const migrated: ProjectMeta = {
    id: legacyId,
    name: "My Project",
    createdAt: Date.now(),
  };
  await writeProjectsIndex(root, {
    projects: [migrated],
    lastActiveId: legacyId,
  });

  return migrated;
}

interface FolderState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  apiKey: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  projects: ProjectMeta[];
  activeProjectId: string | null;
  saveApiKey: (key: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearData: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folderHandle: null,
  folderName: null,
  apiKey: null,
  isConfigured: false,
  isLoading: true,
  error: null,
  projects: [],
  activeProjectId: null,

  saveApiKey: async (key: string) => {
    const { activeProjectId } = get();
    try {
      await localforage.setItem(API_KEY_STORAGE_KEY, key.trim());
      set({ apiKey: key.trim(), isConfigured: !!activeProjectId, error: null });
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

      let index = await readProjectsIndex(root);

      // Migration: existing root files → create a project
      if (!index) {
        const migrated = await migrateLegacyProject(root);
        if (migrated) {
          index = { projects: [migrated], lastActiveId: migrated.id };
        }
      }

      if (index && index.projects.length > 0) {
        // Load the last active project
        const activeId = index.lastActiveId || index.projects[0].id;
        const projMeta = index.projects.find((p) => p.id === activeId);
        const projDir = await getProjectDirectory(root, activeId);

        set({
          folderHandle: projDir,
          folderName: projMeta?.name ?? "Untitled",
          apiKey: storedKey,
          isConfigured: !!storedKey,
          projects: index.projects,
          activeProjectId: activeId,
          isLoading: false,
        });
      } else {
        // No projects — auto-create a default one
        const defaultId = crypto.randomUUID();
        const projDir = await getProjectDirectory(root, defaultId);
        const defaultProject: ProjectMeta = {
          id: defaultId,
          name: "My Project",
          createdAt: Date.now(),
        };
        await writeProjectsIndex(root, {
          projects: [defaultProject],
          lastActiveId: defaultId,
        });

        set({
          folderHandle: projDir,
          folderName: "My Project",
          apiKey: storedKey,
          isConfigured: !!storedKey,
          projects: [defaultProject],
          activeProjectId: defaultId,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, error: "Failed to load storage" });
    }
  },

  clearData: async () => {
    const root = await getOpfsRoot();
    if (root) {
      try {
        await removeProjectDirectory(root, "all");
        // Remove the projects-index and all project dirs
        try {
          const projDir = await root.getDirectoryHandle("projects");
          await root.removeEntry("projects", { recursive: true });
          void projDir;
        } catch {
          // no projects dir
        }
        try { await root.removeEntry("projects-index.json"); } catch { /* */ }
        try { await root.removeEntry("movie.json"); } catch { /* */ }
        try { await root.removeEntry("character.json"); } catch { /* */ }
        try { await root.removeEntry("scene.json"); } catch { /* */ }
        try { await root.removeEntry("video.json"); } catch { /* */ }
        try { await root.removeEntry("moments.json"); } catch { /* */ }
        try { await root.removeEntry("images", { recursive: true }); } catch { /* */ }
        try { await root.removeEntry("clips", { recursive: true }); } catch { /* */ }
      } catch {
        // best-effort cleanup
      }
    }
    await localforage.removeItem(API_KEY_STORAGE_KEY);
    set({
      folderHandle: null,
      folderName: null,
      apiKey: null,
      isConfigured: false,
      error: null,
      projects: [],
      activeProjectId: null,
    });
  },

  createProject: async (name: string) => {
    const root = await getOpfsRoot();
    if (!root) return;

    const id = crypto.randomUUID();
    const projDir = await getProjectDirectory(root, id);
    const newProject: ProjectMeta = {
      id,
      name: name.trim(),
      createdAt: Date.now(),
    };

    const index = await readProjectsIndex(root);
    const projects = index ? [...index.projects, newProject] : [newProject];
    await writeProjectsIndex(root, {
      projects,
      lastActiveId: id,
    });

    set({
      folderHandle: projDir,
      folderName: newProject.name,
      projects,
      activeProjectId: id,
      isConfigured: true,
    });
  },

  switchProject: async (projectId: string) => {
    const root = await getOpfsRoot();
    if (!root) return;

    const index = await readProjectsIndex(root);
    if (!index) return;

    const project = index.projects.find((p) => p.id === projectId);
    if (!project) return;

    await writeProjectsIndex(root, { ...index, lastActiveId: projectId });
    const projDir = await getProjectDirectory(root, projectId);

    set({
      folderHandle: projDir,
      folderName: project.name,
      activeProjectId: projectId,
      projects: index.projects,
    });
  },

  deleteProject: async (projectId: string) => {
    const root = await getOpfsRoot();
    if (!root) return;

    const index = await readProjectsIndex(root);
    if (!index) return;

    const remaining = index.projects.filter((p) => p.id !== projectId);
    if (remaining.length === 0) {
      // Deleting the last project — create a fresh default
      const defaultId = crypto.randomUUID();
      const projDir = await getProjectDirectory(root, defaultId);
      const defaultProject: ProjectMeta = {
        id: defaultId,
        name: "My Project",
        createdAt: Date.now(),
      };
      await removeProjectDirectory(root, projectId);
      await writeProjectsIndex(root, {
        projects: [defaultProject],
        lastActiveId: defaultId,
      });

      set({
        folderHandle: projDir,
        folderName: defaultProject.name,
        projects: [defaultProject],
        activeProjectId: defaultId,
      });
      return;
    }

    await removeProjectDirectory(root, projectId);

    const nextActiveId =
      index.lastActiveId === projectId
        ? remaining[0].id
        : index.lastActiveId;
    const nextProject = remaining.find((p) => p.id === nextActiveId)!;

    await writeProjectsIndex(root, {
      projects: remaining,
      lastActiveId: nextActiveId,
    });

    // Only switch folderHandle if we deleted the active project
    if (get().activeProjectId === projectId) {
      const projDir = await getProjectDirectory(root, nextActiveId);
      set({
        folderHandle: projDir,
        folderName: nextProject.name,
        projects: remaining,
        activeProjectId: nextActiveId,
      });
    } else {
      set({
        projects: remaining,
      });
    }
  },

  renameProject: async (projectId: string, name: string) => {
    const root = await getOpfsRoot();
    if (!root) return;

    const index = await readProjectsIndex(root);
    if (!index) return;

    const updated = index.projects.map((p) =>
      p.id === projectId ? { ...p, name: name.trim() } : p,
    );
    await writeProjectsIndex(root, { ...index, projects: updated });

    set({
      projects: updated,
      folderName:
        get().activeProjectId === projectId
          ? name.trim()
          : get().folderName,
    });
  },
}));
