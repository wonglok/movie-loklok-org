import { create } from "zustand";
import {
  agentQueue,
  type AgentJob,
  type AgentType,
  type QueueStats,
} from "@/lib/agent-queue";

interface AgentState {
  jobs: AgentJob[];
  runningJobs: AgentJob[];
  stats: QueueStats;
  isAnyRunning: boolean;

  enqueue: (job: AgentJob) => void;
  cancelJob: (id: string) => void;
  cancelAll: (projectId?: string) => void;
  refresh: () => void;
}

export type { AgentJob, AgentType, QueueStats };

export const useAgentStore = create<AgentState>((set) => ({
  jobs: [],
  runningJobs: [],
  stats: {
    pending: 0,
    running: 0,
    done: 0,
    error: 0,
    byType: {} as Record<AgentType, { pending: number; running: number }>,
  },
  isAnyRunning: false,

  enqueue: (job) => {
    agentQueue.enqueue(job);
  },

  cancelJob: (id) => {
    agentQueue.cancel(id);
  },

  cancelAll: (projectId?) => {
    agentQueue.cancelAll(projectId);
  },

  refresh: () => {
    set({
      jobs: agentQueue.getJobs(),
      runningJobs: agentQueue.getRunningJobs(),
      stats: agentQueue.getStats(),
      isAnyRunning: agentQueue.getStats().running > 0,
    });
  },
}));

// Subscribe to queue changes so the store stays in sync
agentQueue.subscribe(() => {
  useAgentStore.getState().refresh();
});
