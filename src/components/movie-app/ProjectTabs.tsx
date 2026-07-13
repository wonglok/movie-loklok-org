"use client";

import { useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useMovieStore } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

export function ProjectTabs() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const resetProject = useMovieStore((s) => s.resetProject);
  const isGenerating = useMovieStore((s) => s.isGenerating);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const setActiveProjectId = useFolderStore((s) => s.setActiveProjectId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (projects.length <= 0) return null;

  const handleSwitch = async (id: string) => {
    if (id === activeProjectId || isGenerating) return;
    resetProject();
    setActiveProject(id);
    await setActiveProjectId(id);
  };

  return (
    <div>
      {isGenerating && (
        <div className="max-w-5xl mx-auto px-6 pt-2">
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-200">
            <svg
              className="w-4 h-4 shrink-0 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Generation in progress — please do not switch tabs</span>
          </div>
        </div>
      )}

      <div className="w-full border-b border-neutral-800 bg-neutral-950 rounded-full">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-0.5 overflow-x-auto blender-scrollbar">
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            const isEditing = editingId === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex items-center gap-1 px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                  isGenerating ? "cursor-not-allowed opacity-50" : ""
                } ${
                  isActive
                    ? "text-white border-white"
                    : "text-neutral-500 border-transparent hover:text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && editName.trim()) {
                        await renameProject(
                          folderHandle!,
                          editingId,
                          editName.trim(),
                        );
                        setEditingId(null);
                        setEditName("");
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                        setEditName("");
                      }
                    }}
                    onBlur={async () => {
                      if (editName.trim()) {
                        await renameProject(
                          folderHandle!,
                          editingId,
                          editName.trim(),
                        );
                      }
                      setEditingId(null);
                      setEditName("");
                    }}
                    autoFocus
                    className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-white text-sm w-36 focus:outline-none focus:border-neutral-400"
                  />
                ) : (
                  <button
                    onClick={() => handleSwitch(p.id)}
                    disabled={isGenerating}
                    className="text-left"
                  >
                    {typeof p.name === "string" ? p.name : String(p.id)}
                  </button>
                )}
                {!isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(p.id);
                      setEditName(typeof p.name === "string" ? p.name : "");
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
                    title="Rename project"
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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

//
