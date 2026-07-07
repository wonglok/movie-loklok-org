"use client";

import { useState } from "react";
import type { Character, Conversation } from "@/stores/movie-store";
import { ASPECT_OPTIONS, RESOLUTION_OPTIONS } from "@/stores/movie-store";

interface SceneCardProps {
  scene: Character;
  imageRegenId: string | null;
  descRegenId: string | null;
  scriptRegenId: string | null;
  generatingVideoId: string | null;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRegenerateImage: (id: string) => void;
  onRegenerateDescription: (id: string) => void;
  onRegenerateScript: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  folderHandle: FileSystemDirectoryHandle | null;
  updateScene: (id: string, updates: Partial<Character>) => void;
  availableReferences: { id: string; name: string }[];
}

export function SceneCard({
  scene,
  imageRegenId,
  descRegenId,
  scriptRegenId,
  generatingVideoId,
  selected,
  onToggleSelect,
  onRegenerateImage,
  onRegenerateDescription,
  onRegenerateScript,
  onGenerateVideo,
  onRemove,
  onPreview,
  folderHandle,
  updateScene,
  availableReferences,
}: SceneCardProps) {
  const conversations = scene.conversations || [];
  const [showVideo, setShowVideo] = useState(false);

  const updateConversation = (
    convId: string,
    updates: Partial<Conversation>,
  ) => {
    updateScene(scene.id, {
      conversations: conversations.map((c) =>
        c.id === convId ? { ...c, ...updates } : c,
      ),
    });
  };

  const addConversation = () => {
    updateScene(scene.id, {
      conversations: [
        ...conversations,
        { id: crypto.randomUUID(), person: "", line: "" },
      ],
    });
  };

  const removeConversation = (convId: string) => {
    updateScene(scene.id, {
      conversations: conversations.filter((c) => c.id !== convId),
    });
  };

  return (
    <div
      className={`relative bg-neutral-900 border rounded-2xl overflow-hidden group/card ${
        selected ? "border-(--blender-accent)" : "border-neutral-800"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(scene.id)}
        className="absolute top-3 left-3 w-7 h-7 rounded-full border-neutral-600 bg-neutral-800 accent-(--blender-accent) cursor-pointer z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <button
        onClick={() => onRemove(scene.id)}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100 transition-all z-10"
        title="Remove scene"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div className="flex gap-4 p-4">
        <div
          className={`flex-none w-44 aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 ${
            scene.imageUrl
              ? "cursor-zoom-in hover:border-neutral-500 transition-colors"
              : ""
          }`}
          onClick={() => {
            if (scene.imageUrl) onPreview(scene.id);
          }}
        >
          {scene.imageUrl ? (
            <img
              src={scene.imageUrl}
              alt={scene.name}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl text-neutral-600">
                {scene.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <input
            type="text"
            value={scene.name}
            onChange={(e) => updateScene(scene.id, { name: e.target.value })}
            placeholder="Scene name"
            className="w-full bg-transparent text-white font-semibold text-sm focus:outline-none placeholder-neutral-600"
          />
          <textarea
            value={scene.description}
            onChange={(e) =>
              updateScene(scene.id, { description: e.target.value })
            }
            placeholder="Scene description"
            rows={3}
            className="w-full bg-transparent text-neutral-400 text-xs leading-relaxed focus:outline-none placeholder-neutral-600 resize-none blender-scrollbar"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onRegenerateDescription(scene.id)}
              disabled={
                imageRegenId !== null ||
                descRegenId !== null ||
                scriptRegenId !== null
              }
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {descRegenId === scene.id ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                  Generating...
                </>
              ) : (
                "Desc"
              )}
            </button>

            <button
              onClick={() => onRegenerateScript(scene.id)}
              disabled={
                imageRegenId !== null ||
                descRegenId !== null ||
                scriptRegenId !== null
              }
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {scriptRegenId === scene.id ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                  Generating...
                </>
              ) : (
                "Script"
              )}
            </button>

            <button
              onClick={() => onRegenerateImage(scene.id)}
              disabled={
                imageRegenId !== null ||
                descRegenId !== null ||
                scriptRegenId !== null
              }
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {imageRegenId === scene.id ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                  Generating...
                </>
              ) : (
                "Img"
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              id={`scene-upload-${scene.id}`}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !folderHandle) return;
                try {
                  const imagesDir = await folderHandle.getDirectoryHandle(
                    "images",
                    { create: true },
                  );
                  const sceneDirHandle = await imagesDir.getDirectoryHandle(
                    "scene",
                    { create: true },
                  );
                  const uploadId = crypto.randomUUID();
                  const filename = `${uploadId}.png`;
                  const fileHandle = await sceneDirHandle.getFileHandle(
                    filename,
                    { create: true },
                  );
                  const writable = await fileHandle.createWritable();
                  await writable.write(file);
                  await writable.close();
                  if (scene.imageUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(scene.imageUrl);
                  }
                  const localUrl = URL.createObjectURL(file);
                  updateScene(scene.id, {
                    imageUrl: localUrl,
                    imageFilename: filename,
                  });
                } catch {
                  // upload failed, ignore
                }
                e.target.value = "";
              }}
            />
            <button
              onClick={() =>
                document.getElementById(`scene-upload-${scene.id}`)?.click()
              }
              className="px-2 py-1.5 border border-neutral-700 rounded-lg text-neutral-500 text-xs hover:border-neutral-500 hover:text-neutral-300 transition-colors"
              title="Upload image"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer: Video generation */}
      {scene.imageFilename && (
        <div className="border-t border-neutral-800 px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <select
                value={scene.videoAspect}
                onChange={(e) =>
                  updateScene(scene.id, {
                    videoAspect: e.target.value as Character["videoAspect"],
                  })
                }
                className="bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600"
              >
                {ASPECT_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                value={scene.videoResolution}
                onChange={(e) =>
                  updateScene(scene.id, {
                    videoResolution: e.target
                      .value as Character["videoResolution"],
                  })
                }
                className="bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600"
              >
                {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onGenerateVideo(scene.id)}
              disabled={generatingVideoId !== null}
              className="shrink-0 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {generatingVideoId === scene.id ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent " />
                  Generating...
                </>
              ) : (
                "Gen Video"
              )}
            </button>
          </div>

          {availableReferences.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-neutral-500 text-[10px] font-medium">
                Video References
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableReferences.map((ref) => {
                  const isChecked = (scene.videoReferenceIds ?? []).includes(
                    ref.id,
                  );
                  return (
                    <label
                      key={ref.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700/70 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const ids = scene.videoReferenceIds ?? [];
                          const next = isChecked
                            ? ids.filter((rid) => rid !== ref.id)
                            : [...ids, ref.id];
                          updateScene(scene.id, {
                            videoReferenceIds: next,
                          });
                        }}
                        className="w-3 h-3 rounded border-neutral-600 bg-neutral-700 accent-(--blender-accent) cursor-pointer"
                      />
                      <span className="text-neutral-400 text-[10px] truncate max-w-[80px]">
                        {ref.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video preview + fullscreen modal */}
      {/* {scene.videoUrl && (
        <div className="border-t border-neutral-800 px-4 py-3">
          <video
            src={scene.videoUrl}
            className="w-full max-h-[400px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-contain bg-black"
            muted
            preload="metadata"
            onClick={() => setShowVideo(true)}
          />
        </div>
      )} */}

      {/* Fullscreen video modal */}
      {showVideo && scene.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setShowVideo(false)}
        >
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <video
            src={scene.videoUrl}
            className="max-w-full max-h-full rounded-lg"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Footer: Conversations */}
      <div className="border-t border-neutral-800 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-xs font-medium">
            Conversations
          </span>
          <span className="text-neutral-600 text-xs">
            {conversations.length}
          </span>
        </div>
        {conversations.map((conv) => (
          <div key={conv.id} className="flex items-start gap-1.5 group/conv">
            <input
              type="text"
              value={conv.person}
              onChange={(e) =>
                updateConversation(conv.id, { person: e.target.value })
              }
              placeholder="Actor / VO"
              className="w-24 shrink-0 bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600 placeholder-neutral-600"
            />
            <input
              type="text"
              value={conv.line}
              onChange={(e) =>
                updateConversation(conv.id, { line: e.target.value })
              }
              placeholder="Line of script..."
              className="flex-1 bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600 placeholder-neutral-600"
            />
            <button
              onClick={() => removeConversation(conv.id)}
              className="shrink-0 p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/conv:opacity-100 transition-all"
              title="Remove line"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addConversation}
          className="self-start px-2 py-1 border border-dashed border-neutral-700 rounded text-neutral-500 text-xs hover:border-neutral-500 hover:text-neutral-300 transition-colors"
        >
          + Add Line
        </button>
        {scene.videoUrl && (
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setShowVideo(true)}
              className="px-3 py-1.5 border border-green-700 rounded-lg text-green-400 text-xs hover:bg-green-400/10 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
            <a
              href={scene.videoUrl}
              download={`${scene.name || "scene"}.mp4`}
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Video preview + fullscreen modal */}
      {scene.videoUrl && (
        <div className="border-t border-neutral-800 px-4 py-3">
          <video
            src={scene.videoUrl}
            className="w-full max-h-[400px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-contain bg-black"
            muted
            preload="metadata"
            onClick={() => setShowVideo(true)}
          />
        </div>
      )}
    </div>
  );
}
