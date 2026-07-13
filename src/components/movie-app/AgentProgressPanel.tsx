"use client";

import { useAgentStore } from "@/stores/agent-store";
import type { AgentType } from "@/lib/agent-queue";

const AGENT_LABELS: Record<AgentType, string> = {
  "character-image": "Character Image",
  "scene-image": "Scene Image",
  "scene-video": "Scene Video",
  "reference-video": "Reference Video",
  script: "Script",
  extraction: "Extraction",
};

const AGENT_ICONS: Record<AgentType, string> = {
  "character-image": "🧑‍🎤",
  "scene-image": "🎬",
  "scene-video": "🎥",
  "reference-video": "📹",
  script: "📝",
  extraction: "🔍",
};

export function AgentProgressPanel() {
  const runningJobs = useAgentStore((s) => s.runningJobs);
  const jobs = useAgentStore((s) => s.jobs);
  const stats = useAgentStore((s) => s.stats);
  const isAnyRunning = useAgentStore((s) => s.isAnyRunning);
  const cancelJob = useAgentStore((s) => s.cancelJob);
  const cancelAll = useAgentStore((s) => s.cancelAll);

  const totalActive = stats.running + stats.pending;

  if (totalActive === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-(--blender-accent)/30 border-t-(--blender-accent)" />
          <span className="text-white text-sm font-medium">
            {stats.running} running, {stats.pending} queued
          </span>
        </div>
        <button
          onClick={() => cancelAll()}
          className="text-neutral-500 hover:text-red-400 text-xs transition-colors"
        >
          Cancel All
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto blender-scrollbar">
        {runningJobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/50"
          >
            <span className="text-sm">{AGENT_ICONS[job.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">
                {AGENT_LABELS[job.type]}
              </div>
              <div className="text-neutral-500 text-[10px] truncate">
                {job.targetName}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-(--blender-accent)/30 border-t-(--blender-accent)" />
              <button
                onClick={() => cancelJob(job.id)}
                className="text-neutral-600 hover:text-red-400 transition-colors"
                title="Cancel"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {jobs.slice(0, 10).map((job) => (
          <div
            key={job.id}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/50 opacity-50"
          >
            <span className="text-sm">{AGENT_ICONS[job.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-neutral-400 text-xs font-medium truncate">
                {AGENT_LABELS[job.type]}
              </div>
              <div className="text-neutral-600 text-[10px] truncate">
                {job.targetName} — queued
              </div>
            </div>
            <button
              onClick={() => cancelJob(job.id)}
              className="text-neutral-600 hover:text-red-400 transition-colors"
              title="Cancel"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}

        {jobs.length > 10 && (
          <div className="px-4 py-2 text-neutral-600 text-xs text-center">
            +{jobs.length - 10} more queued
          </div>
        )}
      </div>
    </div>
  );
}
