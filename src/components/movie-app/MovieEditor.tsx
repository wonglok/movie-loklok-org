"use client";

import { useState, useCallback } from "react";
import type { Character } from "@/stores/movie-store";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

interface MovieEditorProps {
  scenes: Character[];
  folderHandle: FileSystemDirectoryHandle | null;
  updateScene: (id: string, updates: Partial<Character>) => void;
}

export function MovieEditor({
  scenes,
  folderHandle,
  updateScene,
}: MovieEditorProps) {
  const [stitching, setStitching] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const scenesWithVideo = scenes.filter((s) => s.videoUrl);

  const move = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= scenesWithVideo.length) return;
    const allScenes = [...scenes];
    const a = allScenes.findIndex((s) => s.id === scenesWithVideo[index].id);
    const b = allScenes.findIndex(
      (s) => s.id === scenesWithVideo[targetIdx].id,
    );
    [allScenes[a], allScenes[b]] = [allScenes[b], allScenes[a]];
    // Re-set the entire array to trigger re-render
    for (const s of allScenes) {
      updateScene(s.id, {});
    }
  };

  const handleStitch = useCallback(async () => {
    if (!folderHandle || scenesWithVideo.length < 2) return;
    setStitching(true);
    setProgress("Loading FFmpeg...");

    try {
      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress: p }) => {
        setProgress(`Processing: ${Math.round(p * 100)}%`);
      });

      await ffmpeg.load();

      // Write input files
      const listLines: string[] = [];
      setProgress("Loading video files...");

      for (let i = 0; i < scenesWithVideo.length; i++) {
        const scene = scenesWithVideo[i];
        if (!scene.videoFilename) continue;

        const clipsDir = await folderHandle.getDirectoryHandle("clips");
        const fileHandle = await clipsDir.getFileHandle(scene.videoFilename);
        const file = await fileHandle.getFile();
        const inputName = `input_${i}.mp4`;
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        listLines.push(`file '${inputName}'`);
      }

      // Write concat list
      await ffmpeg.writeFile("concat.txt", listLines.join("\n"));

      // Run concat
      setProgress("Stitching videos...");
      await ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c",
        "copy",
        "output.mp4",
      ]);

      // Read output
      setProgress("Preparing download...");
      const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
      const blob = new Blob([new Uint8Array(data)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement("a");
      a.href = url;
      a.download = "movie.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress("Done!");
      setTimeout(() => setProgress(""), 2000);
    } catch (err) {
      setProgress(err instanceof Error ? err.message : "Stitching failed");
    } finally {
      setStitching(false);
    }
  }, [folderHandle, scenesWithVideo]);

  if (scenesWithVideo.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">&#x1F3AC;</span>
        <h2 className="text-xl font-semibold text-white">Movie Editor</h2>
        <span className="text-sm text-neutral-500">
          {scenesWithVideo.length}{" "}
          {scenesWithVideo.length === 1 ? "scene" : "scenes"}
        </span>
      </div>

      {/* <div className="flex flex-col gap-2">
        {scenesWithVideo.map((scene, i) => (
          <div
            key={scene.id}
            className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3"
          >
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => move(i, "up")}
                disabled={i === 0}
                className="text-neutral-500 hover:text-neutral-200 disabled:opacity-20 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => move(i, "down")}
                disabled={i === scenesWithVideo.length - 1}
                className="text-neutral-500 hover:text-neutral-200 disabled:opacity-20 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
            <span className="text-neutral-400 text-xs w-6">{i + 1}.</span>
            <span className="text-white text-sm flex-1 truncate">
              {scene.name || `Scene ${i + 1}`}
            </span>
            <span className="text-neutral-500 text-xs">
              {scene.videoDuration}s
            </span>
          </div>
        ))}
      </div> */}

      {scenesWithVideo.length >= 1 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleStitch}
            disabled={stitching || scenesWithVideo.length < 2}
            className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {stitching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />
                Stitching...
              </>
            ) : (
              "Stitch & Download"
            )}
          </button>
          {progress && !stitching && (
            <span className="text-neutral-400 text-xs">{progress}</span>
          )}
          {stitching && progress && (
            <span className="text-neutral-400 text-xs">{progress}</span>
          )}
        </div>
      )}
    </section>
  );
}
