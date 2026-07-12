"use client";

import { useState } from "react";
import { useProjectStore, type ProjectMeta } from "@/stores/project-store";
import { useMovieStore } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";
import { RemoveConfirmModal } from "./RemoveConfirmModal";

export function ProjectSwitcher() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const isLoading = useProjectStore((s) => s.isLoading);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const resetProject = useMovieStore((s) => s.resetProject);
  const folderHandle = useFolderStore((s) => s.folderHandle);
  const setActiveProjectId = useFolderStore((s) => s.setActiveProjectId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);
  const [contextProject, setContextProject] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleCreate = async () => {
    if (!newName.trim() || !folderHandle) return;
    await createProject(folderHandle, newName.trim());
    setNewName("");
    setCreating(false);
  };

  const handleSwitch = async (id: string) => {
    if (id === activeProjectId) return;
    resetProject();
    setActiveProject(id);
    await setActiveProjectId(id);
    setMenuOpen(false);
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim() || !folderHandle) return;
    await renameProject(folderHandle, id, renameValue.trim());
    setRenaming(null);
    setRenameValue("");
  };

  const handleDelete = async () => {
    if (!deleteTarget || !folderHandle) return;
    await deleteProject(folderHandle, deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDuplicate = async (id: string) => {
    if (!folderHandle) return;
    const newId = await duplicateProject(folderHandle, id);
    resetProject();
    await setActiveProjectId(newId);
    setContextProject(null);
    setMenuOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm hover:border-neutral-600 transition-colors"
        >
          <span className="text-neutral-400">
            {isLoading
              ? "Loading..."
              : typeof activeProject?.name === "string"
                ? activeProject.name
                : "No Project"}
          </span>
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
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

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setMenuOpen(false);
                setContextProject(null);
              }}
            />
            <div className="absolute top-full mt-2 left-0 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors group"
                  >
                    {renaming === p.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(p.id);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onBlur={() => setRenaming(null)}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => handleSwitch(p.id)}
                        className={`flex-1 text-left text-sm truncate ${
                          p.id === activeProjectId
                            ? "text-white font-medium"
                            : "text-neutral-400"
                        }`}
                      >
                        {typeof p.name === "string" ? p.name : String(p.id)}
                      </button>
                    )}
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming(p.id);
                          setRenameValue(p.name);
                          setContextProject(null);
                        }}
                        className="p-1 text-neutral-500 hover:text-white transition-colors rounded"
                        title="Rename"
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(p.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-white transition-colors rounded"
                        title="Duplicate"
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
                            d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(p);
                          setContextProject(null);
                        }}
                        className="p-1 text-neutral-500 hover:text-red-400 transition-colors rounded"
                        title="Delete"
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-800 p-2">
                {creating ? (
                  <div className="flex items-center gap-2 px-3 py-1">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                        if (e.key === "Escape") {
                          setCreating(false);
                          setNewName("");
                        }
                      }}
                      placeholder="Project name..."
                      autoFocus
                      className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-600 rounded text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-200 disabled:opacity-30 transition-colors"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-neutral-400 text-sm hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
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
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    New Project
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {deleteTarget !== null && (
        <RemoveConfirmModal
          type="project"
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
