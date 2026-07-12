"use client";

import { useProjectStore } from "@/stores/project-store";
import { useMovieStore } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

export function ProjectTabs() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const resetProject = useMovieStore((s) => s.resetProject);
  const isGenerating = useMovieStore((s) => s.isGenerating);
  const setActiveProjectId = useFolderStore((s) => s.setActiveProjectId);

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
            <svg className="w-4 h-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Generation in progress — please do not switch tabs</span>
          </div>
        </div>
      )}
      <div className="w-full border-b border-neutral-800 bg-neutral-950 rounded-full">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-0.5 overflow-x-auto blender-scrollbar">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          return (
            <button
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              disabled={isGenerating}
              className={`relative px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
                isGenerating
                  ? "cursor-not-allowed opacity-50"
                  : ""
              } ${
                isActive
                  ? "text-white border-white"
                  : "text-neutral-500 border-transparent hover:text-neutral-300 hover:border-neutral-600"
              }`}
            >
              {typeof p.name === "string" ? p.name : String(p.id)}
            </button>
          );
        })}
      </div>
    </div>
    </div>
  );
}
