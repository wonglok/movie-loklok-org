"use client";

import { useProjectStore } from "@/stores/project-store";
import { useMovieStore } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

export function ProjectTabs() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const resetProject = useMovieStore((s) => s.resetProject);
  const setActiveProjectId = useFolderStore((s) => s.setActiveProjectId);

  if (projects.length <= 0) return null;

  const handleSwitch = async (id: string) => {
    if (id === activeProjectId) return;
    resetProject();
    setActiveProject(id);
    await setActiveProjectId(id);
  };

  return (
    <div className="w-full border-b border-neutral-800 bg-neutral-950 rounded-full">
      <div className="max-w-5xl mx-auto px-6 flex items-center gap-0.5 overflow-x-auto blender-scrollbar">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          return (
            <button
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              className={`relative px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
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
  );
}
