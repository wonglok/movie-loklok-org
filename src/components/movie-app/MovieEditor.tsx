"use client";

import { useState, useCallback, useRef } from "react";
import type { Character } from "@/stores/movie-store";
import { useMovieStore } from "@/stores/movie-store";
import {
  getProjectClipsDir,
  getProjectImagesDir,
  archiveFile,
} from "@/lib/fs-helpers";
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
  const [currentTask, setCurrentTask] = useState("");
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentTaskProgress, setCurrentTaskProgress] = useState(0);
  const [extractingFrame, setExtractingFrame] = useState(false);
  const [frameExtractMsg, setFrameExtractMsg] = useState("");

  const progressRef = useRef({ step: 0, total: 0 });

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
    const projectId = useMovieStore.getState().projectId;
    if (!folderHandle || !projectId || scenesWithVideo.length < 2) return;
    setStitching(true);
    setOverallProgress(0);
    setCurrentTaskProgress(0);
    setCurrentTask("Loading FFmpeg...");

    try {
      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress: p }) => {
        const clipPct = Math.round(p * 100);
        setCurrentTaskProgress(clipPct);
        const { step, total } = progressRef.current;
        setOverallProgress(
          total > 0 ? Math.round(((step + p) / total) * 100) : 0,
        );
      });

      await ffmpeg.load();

      const clipsDir = await getProjectClipsDir(folderHandle, projectId);

      const clips = scenesWithVideo.filter((s) => s.videoFilename);
      const totalSteps = clips.length + 1; // normalize each + concat
      progressRef.current = { step: 0, total: totalSteps };

      // Step 1: normalize each clip to a uniform mp4, skipping failures
      const normLines: string[] = [];
      const skipped: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const scene = clips[i];
        const taskLabel = `Converting clip ${i + 1} of ${clips.length}`;
        setCurrentTask(taskLabel);
        setCurrentTaskProgress(0);
        progressRef.current = { step: i, total: totalSteps };

        try {
          const fileHandle = await clipsDir.getFileHandle(scene.videoFilename!);
          const file = await fileHandle.getFile();
          const inputName = `raw_${i}.mp4`;
          const normName = `norm_${i}.mp4`;

          await ffmpeg.writeFile(inputName, await fetchFile(file));

          await ffmpeg.exec([
            "-i",
            inputName,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "17",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            normName,
          ]);

          await ffmpeg.deleteFile(inputName);
          normLines.push(`file '${normName}'`);
        } catch {
          skipped.push(scene.name || `Scene ${i + 1}`);
          // Skip this clip and continue with the rest
        }
      }

      if (normLines.length === 0) {
        throw new Error(
          "No clips could be processed. All files are missing or unreadable.",
        );
      }

      // Step 2: concat normalized clips with stream copy
      setCurrentTask("Stitching clips together");
      setCurrentTaskProgress(0);
      progressRef.current = { step: clips.length, total: totalSteps };

      await ffmpeg.writeFile("concat.txt", normLines.join("\n"));
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
      setCurrentTask("Preparing download...");
      setCurrentTaskProgress(100);
      setOverallProgress(100);

      const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
      const blob = new Blob([new Uint8Array(data)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "movie.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (skipped.length > 0) {
        setCurrentTask(
          `Done! (${skipped.length} clip(s) skipped: ${skipped.join(", ")})`,
        );
      } else {
        setCurrentTask("Done!");
      }
      setTimeout(() => {
        setCurrentTask("");
        setOverallProgress(0);
        setCurrentTaskProgress(0);
      }, 4000);
    } catch (err) {
      setCurrentTask(err instanceof Error ? err.message : "Stitching failed");
      setOverallProgress(0);
      setCurrentTaskProgress(0);
    } finally {
      setStitching(false);
    }
  }, [folderHandle, scenesWithVideo]);

  const handleExtractFirstFrame = useCallback(async () => {
    const projectId = useMovieStore.getState().projectId;
    if (!folderHandle || !projectId || scenesWithVideo.length === 0) return;

    const firstScene = scenesWithVideo[0];
    setExtractingFrame(true);
    setFrameExtractMsg("");

    try {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load();

      const clipsDir = await getProjectClipsDir(folderHandle, projectId);
      const fileHandle = await clipsDir.getFileHandle(
        firstScene.videoFilename!,
      );
      const file = await fileHandle.getFile();
      const inputName = "extract_input.mp4";
      const outputName = "extract_frame.png";

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec([
        "-i",
        inputName,
        "-vframes",
        "1",
        "-q:v",
        "2",
        outputName,
      ]);

      const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

      const imagesDir = await getProjectImagesDir(folderHandle, projectId);
      const sceneDir = await imagesDir.getDirectoryHandle("scene", {
        create: true,
      });
      const archiveDir = await imagesDir.getDirectoryHandle("_archive", {
        create: true,
      });

      if (firstScene.imageFilename) {
        await archiveFile(firstScene.imageFilename, sceneDir, archiveDir);
        await archiveFile(
          firstScene.imageFilename.replace(/\.png$/, ".txt"),
          sceneDir,
          archiveDir,
        );
      }

      const filename = `${crypto.randomUUID()}.png`;
      const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
      const imgFileHandle = await sceneDir.getFileHandle(filename, {
        create: true,
      });
      const writable = await imgFileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      const localUrl = URL.createObjectURL(blob);
      updateScene(firstScene.id, {
        imageUrl: localUrl,
        imageFilename: filename,
      });

      // Trigger download
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      setFrameExtractMsg("Frame extracted and downloaded!");
      setTimeout(() => setFrameExtractMsg(""), 3000);
    } catch (err) {
      setFrameExtractMsg(
        err instanceof Error ? err.message : "Frame extraction failed",
      );
    } finally {
      setExtractingFrame(false);
    }
  }, [folderHandle, scenesWithVideo, updateScene]);

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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExtractFirstFrame}
              disabled={
                extractingFrame || stitching || scenesWithVideo.length === 0
              }
              className="px-6 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {extractingFrame ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-neutral-200" />
                  Extracting...
                </>
              ) : (
                "Extract Frame"
              )}
            </button>
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
          </div>

          {frameExtractMsg && !extractingFrame && (
            <span className="text-neutral-400 text-xs">{frameExtractMsg}</span>
          )}

          {stitching && (
            <div className="flex flex-col gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Overall</span>
                  <span className="text-neutral-500">{overallProgress}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">{currentTask}</span>
                  <span className="text-neutral-500">
                    {currentTaskProgress}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${currentTaskProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {currentTask && !stitching && (
            <span className="text-neutral-400 text-xs">{currentTask}</span>
          )}
        </div>
      )}
    </section>
  );
}
