import type { Character, Moment, VideoInfo } from "@/stores/movie-store";
import JSZip from "jszip";

async function getProjectDir(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectsDir = await folderHandle.getDirectoryHandle("projects", {
    create: true,
  });
  return projectsDir.getDirectoryHandle(projectId, { create: true });
}

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
  projectId: string,
): Promise<{
  story?: string;
  artStyle?: string;
  customArtStyle?: string;
  language?: string;
} | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("movie.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeMovieJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  data: {
    story: string;
    artStyle: string;
    customArtStyle: string;
    language: string;
  },
): Promise<void> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("movie.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<Character[] | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("character.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeCharactersJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  characters: Character[],
): Promise<void> {
  const toSave = characters.map((c) => ({
    ...c,
    imageUrl: null,
    videoUrl: null,
  }));
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("character.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

export async function readScenesJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<Character[] | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("scene.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeScenesJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  scenes: Character[],
): Promise<void> {
  const toSave = scenes.map((c) => ({ ...c, imageUrl: null, videoUrl: null }));
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("scene.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}

export async function readVideoJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<VideoInfo | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("video.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeVideoJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  videoInfo: VideoInfo | null,
): Promise<void> {
  if (!videoInfo) return;
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("video.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(videoInfo, null, 2));
  await writable.close();
}

export async function readMomentsJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<Moment[] | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("moments.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeMomentsJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  moments: Moment[],
): Promise<void> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("moments.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(moments, null, 2));
  await writable.close();
}

export async function readChatJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<import("@/stores/chat-store").ChatMessage[] | null> {
  try {
    const projectDir = await getProjectDir(folderHandle, projectId);
    const fileHandle = await projectDir.getFileHandle("chat.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeChatJson(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  messages: import("@/stores/chat-store").ChatMessage[],
): Promise<void> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  const fileHandle = await projectDir.getFileHandle("chat.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(messages, null, 2));
  await writable.close();
}

export async function getProjectImagesDir(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  return projectDir.getDirectoryHandle("images", { create: true });
}

export async function getProjectClipsDir(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  return projectDir.getDirectoryHandle("clips", { create: true });
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

export async function exportProjectAsZip(
  folderHandle: FileSystemDirectoryHandle,
  projectId: string,
  folderName: string,
): Promise<void> {
  const projectDir = await getProjectDir(folderHandle, projectId);
  const zip = new JSZip();
  await addDirToZip(zip, projectDir);
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

export async function exportWorkspaceAsZip(
  folderHandle: FileSystemDirectoryHandle,
  folderName: string,
): Promise<void> {
  const zip = new JSZip();
  await addDirToZip(zip, folderHandle);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName || "movie-workspace"}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function removeDirContents(
  parent: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name] of parent.entries()) {
    await parent.removeEntry(name, { recursive: true });
  }
}

async function extractZipToDir(
  zip: JSZip,
  dirHandle: FileSystemDirectoryHandle,
): Promise<void> {
  const entries = Object.entries(zip.files);
  for (const [path, file] of entries) {
    if (file.dir) continue;
    const parts = path.split("/");
    const fileName = parts.pop()!;
    let currentDir = dirHandle;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }
    const blob = await file.async("blob");
    const fileHandle = await currentDir.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

export async function pickAndExtractProjectZip(
  folderHandle: FileSystemDirectoryHandle,
): Promise<{
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
} | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;

  const zip = await JSZip.loadAsync(file);

  let name = "Imported Project";
  let createdAt = new Date().toISOString();
  let updatedAt = new Date().toISOString();

  const projectJsonFile = zip.file("project.json");
  if (projectJsonFile) {
    const text = await projectJsonFile.async("text");
    const data = JSON.parse(text);
    name = data.name || name;
    createdAt = data.createdAt || createdAt;
    updatedAt = data.updatedAt || updatedAt;
  }

  const id = crypto.randomUUID();
  const projectDir = await getProjectDir(folderHandle, id);
  await extractZipToDir(zip, projectDir);

  return { id, name, createdAt, updatedAt };
}

export async function importWorkspaceFromZip(
  folderHandle: FileSystemDirectoryHandle,
): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return;
  const zip = await JSZip.loadAsync(file);
  await removeDirContents(folderHandle);
  await extractZipToDir(zip, folderHandle);
}
