import { create } from "zustand";
import { pickAndExtractProjectZip } from "@/lib/fs-helpers";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  isLoading: boolean;

  loadProjects: (folderHandle: FileSystemDirectoryHandle) => Promise<void>;
  createProject: (
    folderHandle: FileSystemDirectoryHandle,
    name: string,
  ) => Promise<string>;
  deleteProject: (
    folderHandle: FileSystemDirectoryHandle,
    id: string,
  ) => Promise<void>;
  renameProject: (
    folderHandle: FileSystemDirectoryHandle,
    id: string,
    name: string,
  ) => Promise<void>;
  duplicateProject: (
    folderHandle: FileSystemDirectoryHandle,
    id: string,
  ) => Promise<string>;
  importProject: (
    folderHandle: FileSystemDirectoryHandle,
  ) => Promise<string | null>;
  setActiveProject: (id: string) => void;
}

async function ensureDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

async function readJsonFile<T>(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<T | null> {
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function writeJsonFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  data: unknown,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function removeDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await parent.removeEntry(name, { recursive: true });
  } catch {
    // dir doesn't exist, ignore
  }
}

async function copyDir(
  src: FileSystemDirectoryHandle,
  dst: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of src.entries()) {
    if (handle.kind === "file") {
      const file = await handle.getFile();
      const dstFile = await dst.getFileHandle(name, { create: true });
      const writable = await dstFile.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    } else if (handle.kind === "directory") {
      const subSrc = await src.getDirectoryHandle(name);
      const subDst = await dst.getDirectoryHandle(name, { create: true });
      await copyDir(subSrc, subDst);
    }
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,

  loadProjects: async (folderHandle) => {
    set({ isLoading: true });
    try {
      const projectsDir = await ensureDir(folderHandle, "projects");
      const projects: ProjectMeta[] = [];
      for await (const [name, handle] of projectsDir.entries()) {
        if (handle.kind === "directory") {
          const meta = await readJsonFile<{ name: string; createdAt: string; updatedAt: string }>(
            await projectsDir.getDirectoryHandle(name),
            "project.json",
          );
          const rawName = meta?.name;
          const rawCreated = meta?.createdAt;
          const rawUpdated = meta?.updatedAt;
          projects.push({
            id: name,
            name: typeof rawName === "string" ? rawName : name,
            createdAt: typeof rawCreated === "string" ? rawCreated : new Date().toISOString(),
            updatedAt: typeof rawUpdated === "string" ? rawUpdated : new Date().toISOString(),
          });
        }
      }
      projects.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      const activeId = get().activeProjectId;
      set({
        projects,
        activeProjectId:
          activeId && projects.some((p) => p.id === activeId)
            ? activeId
            : projects[0]?.id ?? null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  createProject: async (folderHandle, name) => {
    const id = crypto.randomUUID();
    const projectsDir = await ensureDir(folderHandle, "projects");
    const projectDir = await ensureDir(projectsDir, id);
    const now = new Date().toISOString();
    await writeJsonFile(projectDir, "project.json", {
      name,
      createdAt: now,
      updatedAt: now,
    });
    // Initialize empty data files
    await writeJsonFile(projectDir, "movie.json", {
      story: "",
      artStyle: "cartoon-3d",
      customArtStyle: "",
      language: "English",
    });
    await writeJsonFile(projectDir, "character.json", []);
    await writeJsonFile(projectDir, "scene.json", []);
    await writeJsonFile(projectDir, "video.json", null);
    await writeJsonFile(projectDir, "moments.json", []);
    await ensureDir(projectDir, "images");
    await ensureDir(projectDir, "clips");

    const newProject: ProjectMeta = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      projects: [newProject, ...state.projects],
      activeProjectId: id,
    }));
    return id;
  },

  deleteProject: async (folderHandle, id) => {
    const projectsDir = await ensureDir(folderHandle, "projects");
    await removeDir(projectsDir, id);
    set((state) => {
      const remaining = state.projects.filter((p) => p.id !== id);
      return {
        projects: remaining,
        activeProjectId:
          state.activeProjectId === id
            ? (remaining[0]?.id ?? null)
            : state.activeProjectId,
      };
    });
  },

  renameProject: async (folderHandle, id, name) => {
    const projectsDir = await ensureDir(folderHandle, "projects");
    const projectDir = await ensureDir(projectsDir, id);
    const now = new Date().toISOString();
    const existing = await readJsonFile<{
      name: string;
      createdAt: string;
      updatedAt: string;
    }>(projectDir, "project.json");
    await writeJsonFile(projectDir, "project.json", {
      ...existing,
      name,
      updatedAt: now,
    });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: now } : p,
      ),
    }));
  },

  duplicateProject: async (folderHandle, id) => {
    const projectsDir = await ensureDir(folderHandle, "projects");
    const srcDir = await ensureDir(projectsDir, id);
    const srcMeta = await readJsonFile<{
      name: string;
      createdAt: string;
    }>(srcDir, "project.json");
    const newId = crypto.randomUUID();
    const dstDir = await ensureDir(projectsDir, newId);
    await copyDir(srcDir, dstDir);
    const now = new Date().toISOString();
    await writeJsonFile(dstDir, "project.json", {
      name: `${srcMeta?.name ?? "Project"} (Copy)`,
      createdAt: now,
      updatedAt: now,
    });
    const newProject: ProjectMeta = {
      id: newId,
      name: `${srcMeta?.name ?? "Project"} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      projects: [newProject, ...state.projects],
      activeProjectId: newId,
    }));
    return newId;
  },

  importProject: async (folderHandle) => {
    const result = await pickAndExtractProjectZip(folderHandle);
    if (!result) return null;
    const { id, name, createdAt, updatedAt } = result;
    const newProject: ProjectMeta = { id, name, createdAt, updatedAt };
    set((state) => ({
      projects: [newProject, ...state.projects],
      activeProjectId: id,
    }));
    return id;
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
}));
