"use client";

import type { Character, Conversation } from "@/stores/movie-store";

interface SceneCardProps {
  scene: Character;
  index: number;
  sceneRegenIndex: number | null;
  generatingVideoIndex: number | null;
  selected: boolean;
  onToggleSelect: (index: number) => void;
  onRegenerate: (index: number) => void;
  onGenerateVideo: (index: number) => void;
  onRemove: (index: number) => void;
  onPreview: (index: number) => void;
  folderHandle: FileSystemDirectoryHandle | null;
  updateScene: (index: number, updates: Partial<Character>) => void;
}

export function SceneCard({
  scene,
  index,
  sceneRegenIndex,
  generatingVideoIndex,
  selected,
  onToggleSelect,
  onRegenerate,
  onGenerateVideo,
  onRemove,
  onPreview,
  folderHandle,
  updateScene,
}: SceneCardProps) {
  const conversations = scene.conversations || [];

  const updateConversation = (
    convIndex: number,
    updates: Partial<Conversation>,
  ) => {
    const next = [...conversations];
    next[convIndex] = { ...next[convIndex], ...updates };
    updateScene(index, { conversations: next });
  };

  const addConversation = () => {
    updateScene(index, {
      conversations: [...conversations, { person: "", line: "" }],
    });
  };

  const removeConversation = (convIndex: number) => {
    const next = [...conversations];
    next.splice(convIndex, 1);
    updateScene(index, { conversations: next });
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
        onChange={() => onToggleSelect(index)}
        className="absolute top-3 left-3 w-4 h-4 rounded border-neutral-600 bg-neutral-800 accent-(--blender-accent) cursor-pointer z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <button
        onClick={() => onRemove(index)}
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
          className={`flex-none w-44 aspect-video rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 ${
            scene.imageUrl
              ? "cursor-zoom-in hover:border-neutral-500 transition-colors"
              : ""
          }`}
          onClick={() => {
            if (scene.imageUrl) onPreview(index);
          }}
        >
          {scene.imageUrl ? (
            <img
              src={scene.imageUrl}
              alt={scene.name}
              className="w-full h-full object-cover"
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
            onChange={(e) => updateScene(index, { name: e.target.value })}
            placeholder="Scene name"
            className="w-full bg-transparent text-white font-semibold text-sm focus:outline-none placeholder-neutral-600"
          />
          <textarea
            value={scene.description}
            onChange={(e) =>
              updateScene(index, { description: e.target.value })
            }
            placeholder="Scene description"
            rows={3}
            className="w-full bg-transparent text-neutral-400 text-xs leading-relaxed focus:outline-none placeholder-neutral-600 resize-none blender-scrollbar"
          />

          {/* Conversations */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-xs font-medium">
                Conversations
              </span>
              <span className="text-neutral-600 text-xs">
                {conversations.length}
              </span>
            </div>
            {conversations.map((conv, ci) => (
              <div
                key={ci}
                className="flex items-start gap-1.5 group/conv"
              >
                <input
                  type="text"
                  value={conv.person}
                  onChange={(e) =>
                    updateConversation(ci, { person: e.target.value })
                  }
                  placeholder="Actor / VO"
                  className="w-24 shrink-0 bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600 placeholder-neutral-600"
                />
                <input
                  type="text"
                  value={conv.line}
                  onChange={(e) =>
                    updateConversation(ci, { line: e.target.value })
                  }
                  placeholder="Line of script..."
                  className="flex-1 bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600 placeholder-neutral-600"
                />
                <button
                  onClick={() => removeConversation(ci)}
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
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRegenerate(index)}
              disabled={sceneRegenIndex !== null}
              className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {sceneRegenIndex === index ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                  Regenerating...
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
                  Regenerate
                </>
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              id={`scene-upload-${index}`}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !folderHandle) return;
                try {
                  const imagesDir = await folderHandle.getDirectoryHandle(
                    "images",
                    { create: true },
                  );
                  const sceneDir = await imagesDir.getDirectoryHandle("scene", {
                    create: true,
                  });
                  const id = crypto.randomUUID();
                  const filename = `${id}.png`;
                  const fileHandle = await sceneDir.getFileHandle(filename, {
                    create: true,
                  });
                  const writable = await fileHandle.createWritable();
                  await writable.write(file);
                  await writable.close();
                  if (scene.imageUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(scene.imageUrl);
                  }
                  const localUrl = URL.createObjectURL(file);
                  updateScene(index, {
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
                document.getElementById(`scene-upload-${index}`)?.click()
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
        <div className="border-t border-neutral-800 px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-neutral-500 text-xs shrink-0">Duration</span>
            <input
              type="number"
              value={scene.videoDuration}
              onChange={(e) =>
                updateScene(index, {
                  videoDuration: Number(e.target.value) || 0,
                })
              }
              className="w-16 bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600"
              min={1}
            />
            <span className="text-neutral-600 text-xs">s</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-neutral-500 text-xs shrink-0">Camera</span>
            <input
              type="text"
              value={scene.videoCamera}
              onChange={(e) =>
                updateScene(index, { videoCamera: e.target.value })
              }
              className="w-full bg-neutral-800 rounded px-2 py-1 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-600"
              placeholder="Slow pan"
            />
          </div>
          {scene.videoUrl ? (
            <a
              href={scene.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3 py-1.5 border border-green-700 rounded-lg text-green-400 text-xs hover:bg-green-400/10 transition-colors"
            >
              View Video
            </a>
          ) : (
            <button
              onClick={() => onGenerateVideo(index)}
              disabled={generatingVideoIndex !== null}
              className="shrink-0 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {generatingVideoIndex === index ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-neutral-400 border-t-transparent" />
                  Generating...
                </>
              ) : (
                "Generate Video"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
