"use client";

import { useState } from "react";
import type { Character } from "@/stores/movie-store";

interface CharacterCardProps {
  char: Character;
  regeneratingIds: Set<string>;
  referenceVideoGeneratingIds: Set<string>;
  onRegenerate: (id: string) => void;
  onGenerateReferenceVideo: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  folderHandle: FileSystemDirectoryHandle | null;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
}

export function CharacterCard({
  char,
  regeneratingIds,
  referenceVideoGeneratingIds,
  onRegenerate,
  onGenerateReferenceVideo,
  onRemove,
  onPreview,
  folderHandle,
  updateCharacter,
}: CharacterCardProps) {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group/card">
      <button
        onClick={() => onRemove(char.id)}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100 transition-all"
        title="Remove character"
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
          className={`flex-none w-28 aspect-3/4 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 ${
            char.imageUrl
              ? "cursor-zoom-in hover:border-neutral-500 transition-colors"
              : ""
          }`}
          onClick={() => {
            if (char.imageUrl) onPreview(char.id);
          }}
        >
          {char.imageUrl ? (
            <img
              src={char.imageUrl}
              alt={char.name}
              className="w-full h-full object-cover aspect-square"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl text-neutral-600">
                {char.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <input
            type="text"
            value={char.name}
            onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
            placeholder="Character name"
            className="w-full bg-transparent text-white font-semibold text-sm focus:outline-none placeholder-neutral-600"
          />
          <textarea
            value={char.description}
            onChange={(e) =>
              updateCharacter(char.id, { description: e.target.value })
            }
            placeholder="Character description"
            rows={3}
            className="w-full bg-transparent text-neutral-400 text-xs leading-relaxed focus:outline-none placeholder-neutral-600 resize-none blender-scrollbar"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRegenerate(char.id)}
              disabled={regeneratingIds.has(char.id)}
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {regeneratingIds.has(char.id) ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-cyan-400/30 border-t-cyan-400" />
                  <span className="text-cyan-400">Regenerating...</span>
                </>
              ) : (
                <>
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
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                    />
                  </svg>
                  Gen Image
                </>
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              id={`char-upload-${char.id}`}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !folderHandle) return;
                try {
                  const imagesDir = await folderHandle.getDirectoryHandle(
                    "images",
                    { create: true },
                  );
                  const characterDir = await imagesDir.getDirectoryHandle(
                    "character",
                    { create: true },
                  );
                  const uploadId = crypto.randomUUID();
                  const filename = `${uploadId}.png`;
                  const fileHandle = await characterDir.getFileHandle(
                    filename,
                    {
                      create: true,
                    },
                  );
                  const writable = await fileHandle.createWritable();
                  await writable.write(file);
                  await writable.close();
                  if (char.imageUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(char.imageUrl);
                  }
                  const localUrl = URL.createObjectURL(file);
                  updateCharacter(char.id, {
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
                document.getElementById(`char-upload-${char.id}`)?.click()
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

      {/* Footer: Reference Video */}
      {char.imageFilename && (
        <div className="border-t border-neutral-800 px-4 py-3 flex items-center gap-3">
          {char.videoUrl ? (
            <>
              <button
                onClick={() => setShowVideo(true)}
                className="px-3 py-1.5 border border-green-700 rounded-lg text-green-400 text-xs hover:bg-green-400/10 transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play Ref
              </button>

              {showVideo && (
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
                    src={char.videoUrl}
                    className="max-w-full max-h-full rounded-lg"
                    controls
                    autoPlay
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </>
          ) : (
            <></>
          )}

          <button
            onClick={() => onGenerateReferenceVideo(char.id)}
            disabled={referenceVideoGeneratingIds.has(char.id)}
            className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {referenceVideoGeneratingIds.has(char.id) ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border border-cyan-400/30 border-t-cyan-400" />
                <span className="text-cyan-400">Generating...</span>
              </>
            ) : (
              "Generate Ref Video"
            )}
          </button>
          <input
            type="file"
            accept="video/*"
            id={`char-video-upload-${char.id}`}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !folderHandle) return;
              try {
                const clipsDir = await folderHandle.getDirectoryHandle(
                  "clips",
                  {
                    create: true,
                  },
                );
                const uploadId = crypto.randomUUID();
                const filename = `${uploadId}.mp4`;
                const fileHandle = await clipsDir.getFileHandle(filename, {
                  create: true,
                });
                const writable = await fileHandle.createWritable();
                await writable.write(file);
                await writable.close();
                if (char.videoUrl?.startsWith("blob:")) {
                  URL.revokeObjectURL(char.videoUrl);
                }
                const localUrl = URL.createObjectURL(file);
                updateCharacter(char.id, {
                  videoUrl: localUrl,
                  videoFilename: filename,
                });
              } catch {
                // upload failed, ignore
              }
              e.target.value = "";
            }}
          />
          <button
            onClick={() =>
              document.getElementById(`char-video-upload-${char.id}`)?.click()
            }
            className="px-2 py-1.5 border border-neutral-700 rounded-lg text-neutral-500 text-xs hover:border-neutral-500 hover:text-neutral-300 transition-colors"
            title="Upload reference video"
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
      )}
    </div>
  );
}
