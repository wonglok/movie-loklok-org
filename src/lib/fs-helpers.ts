import type { Character, Moment, VideoInfo } from "@/stores/movie-store";
import JSZip from "jszip";

export async function downloadAndSaveImage(
  url: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveAndLoadLocal(
  url: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<string> {
  await downloadAndSaveImage(url, filename, dir);
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

export async function loadLocalImage(
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

export async function savePromptFile(
  prompt: string,
  filename: string,
  dir: FileSystemDirectoryHandle,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(prompt);
  await writable.close();
}

export async function readMovieJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<{
  story?: string;
  artStyle?: string;
  customArtStyle?: string;
  language?: string;
} | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("movie.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeMovieJson(
  folderHandle: FileSystemDirectoryHandle,
  data: {
    story: string;
    artStyle: string;
    customArtStyle: string;
    language: string;
  },
): Promise<void> {
  const fileHandle = await folderHandle.getFileHandle("movie.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<Character[] | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("character.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
  characters: Character[],
): Promise<void> {
  const toSave = characters.map((c) => ({ ...c, imageUrl: null, videoUrl: null }));
  const fileHandle = await folderHandle.getFileHandle("character.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

export async function readScenesJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<Character[] | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("scene.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeScenesJson(
  folderHandle: FileSystemDirectoryHandle,
  scenes: Character[],
): Promise<void> {
  const toSave = scenes.map((c) => ({ ...c, imageUrl: null, videoUrl: null }));
  const fileHandle = await folderHandle.getFileHandle("scene.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

export async function readVideoJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<VideoInfo | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("video.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeVideoJson(
  folderHandle: FileSystemDirectoryHandle,
  videoInfo: VideoInfo | null,
): Promise<void> {
  if (!videoInfo) return;
  const fileHandle = await folderHandle.getFileHandle("video.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(videoInfo, null, 2));
  await writable.close();
}

export async function readMomentsJson(
  folderHandle: FileSystemDirectoryHandle,
): Promise<Moment[] | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle("moments.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeMomentsJson(
  folderHandle: FileSystemDirectoryHandle,
  moments: Moment[],
): Promise<void> {
  const fileHandle = await folderHandle.getFileHandle("moments.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(moments, null, 2));
  await writable.close();
}

async function addDirToZip(
  zip: JSZip,
  dirHandle: FileSystemDirectoryHandle,
  pathPrefix: string = "",
): Promise<void> {
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (handle.kind === "file") {
      const file = await handle.getFile();
      zip.file(fullPath, file);
    } else if (handle.kind === "directory") {
      const subDir = await dirHandle.getDirectoryHandle(name);
      await addDirToZip(zip, subDir, fullPath);
    }
  }
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface ProjectsIndex {
  projects: ProjectMeta[];
  lastActiveId: string;
}

export async function readProjectsIndex(
  root: FileSystemDirectoryHandle,
): Promise<ProjectsIndex | null> {
  try {
    const fileHandle = await root.getFileHandle("projects-index.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeProjectsIndex(
  root: FileSystemDirectoryHandle,
  index: ProjectsIndex,
): Promise<void> {
  const fileHandle = await root.getFileHandle("projects-index.json", { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(index, null, 2));
  await writable.close();
}

export async function getProjectDirectory(
  root: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectsDir = await root.getDirectoryHandle("projects", { create: true });
  return await projectsDir.getDirectoryHandle(projectId, { create: true });
}

export async function removeProjectDirectory(
  root: FileSystemDirectoryHandle,
  projectId: string,
): Promise<void> {
  try {
    const projectsDir = await root.getDirectoryHandle("projects");
    await projectsDir.removeEntry(projectId, { recursive: true });
  } catch {
    // directory doesn't exist
  }
}

export async function exportProjectAsZip(
  folderHandle: FileSystemDirectoryHandle,
  folderName: string,
): Promise<void> {
  const zip = new JSZip();
  await addDirToZip(zip, folderHandle);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName || "movie-project"}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportEntireOpfs(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const zip = new JSZip();
  await addDirToZip(zip, root);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movie-studio-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function removeAllEntries(dir: FileSystemDirectoryHandle): Promise<void> {
  const keys: string[] = [];
  for await (const [name] of dir.entries()) {
    keys.push(name);
  }
  await Promise.all(keys.map((name) => dir.removeEntry(name, { recursive: true })));
}

async function unzipToDir(
  zip: JSZip,
  dir: FileSystemDirectoryHandle,
): Promise<void> {
  const entries = Object.entries(zip.files);
  for (const [path, file] of entries) {
    if (file.dir) continue;
    const parts = path.split("/");
    const fileName = parts.pop()!;
    let currentDir = dir;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }
    const blob = await file.async("blob");
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

export async function importEntireOpfs(zipFile: File): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await removeAllEntries(root);
  const zip = await JSZip.loadAsync(zipFile);
  await unzipToDir(zip, root);
}
