import type { Character } from "@/stores/movie-store";

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
  data: { story: string; artStyle: string; customArtStyle: string },
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
  const toSave = characters.map((c) => ({ ...c, imageUrl: null }));
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
  const toSave = scenes.map((c) => ({ ...c, imageUrl: null }));
  const fileHandle = await folderHandle.getFileHandle("scene.json", {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(toSave, null, 2));
  await writable.close();
}
