export type AgentType =
  | "character-image"
  | "scene-image"
  | "scene-video"
  | "reference-video"
  | "script"
  | "extraction";

export interface AgentJob {
  id: string;
  type: AgentType;
  projectId: string;
  targetId: string;
  targetName: string;
  priority: number;
  status: "pending" | "running" | "done" | "error";
  error?: string;
  execute: (signal: AbortSignal) => Promise<void>;
  abortController: AbortController;
}

export interface QueueStats {
  pending: number;
  running: number;
  done: number;
  error: number;
  byType: Record<AgentType, { pending: number; running: number }>;
}

const DEFAULT_CONCURRENCY: Record<AgentType, number> = {
  "character-image": 3,
  "scene-image": 3,
  "scene-video": 2,
  "reference-video": 2,
  script: 3,
  extraction: 1,
};

type Listener = () => void;

class AgentQueue {
  private jobs: AgentJob[] = [];
  private running: Map<string, AgentJob> = new Map();
  private concurrency: Record<AgentType, number>;
  private listeners: Set<Listener> = new Set();

  constructor(concurrency?: Partial<Record<AgentType, number>>) {
    this.concurrency = { ...DEFAULT_CONCURRENCY, ...concurrency };
  }

  enqueue(job: AgentJob): void {
    this.jobs.push(job);
    this.sortJobs();
    this.notify();
    this.processNext();
  }

  cancel(jobId: string): void {
    const runningJob = this.running.get(jobId);
    if (runningJob) {
      runningJob.abortController.abort();
      this.running.delete(jobId);
    }
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.notify();
    this.processNext();
  }

  cancelAll(projectId?: string): void {
    for (const [id, job] of this.running) {
      if (!projectId || job.projectId === projectId) {
        job.abortController.abort();
        this.running.delete(id);
      }
    }
    if (projectId) {
      this.jobs = this.jobs.filter((j) => j.projectId !== projectId);
    } else {
      this.jobs = [];
    }
    this.notify();
    this.processNext();
  }

  getStats(): QueueStats {
    const byType = {} as Record<
      AgentType,
      { pending: number; running: number }
    >;
    for (const t of Object.keys(this.concurrency) as AgentType[]) {
      byType[t] = { pending: 0, running: 0 };
    }
    for (const j of this.jobs) {
      if (j.status === "pending" && byType[j.type]) {
        byType[j.type].pending++;
      }
    }
    for (const [, j] of this.running) {
      if (byType[j.type]) {
        byType[j.type].running++;
      }
    }
    const allJobs = [...this.jobs, ...this.running.values()];
    return {
      pending: this.jobs.filter((j) => j.status === "pending").length,
      running: this.running.size,
      done: allJobs.filter((j) => j.status === "done").length,
      error: allJobs.filter((j) => j.status === "error").length,
      byType,
    };
  }

  getJobs(): AgentJob[] {
    return [...this.jobs];
  }

  getRunningJobs(): AgentJob[] {
    return [...this.running.values()];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private sortJobs(): void {
    this.jobs.sort((a, b) => {
      // Lower priority number = higher priority
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Same priority: older first
      return 0;
    });
  }

  private canRunMore(type: AgentType): boolean {
    const max = this.concurrency[type] ?? 1;
    const running = [...this.running.values()].filter(
      (j) => j.type === type,
    ).length;
    return running < max;
  }

  private async processNext(): Promise<void> {
    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      if (job.status !== "pending") continue;
      if (!this.canRunMore(job.type)) continue;

      this.jobs.splice(i, 1);
      i--;
      job.status = "running";
      this.running.set(job.id, job);
      this.notify();

      this.executeJob(job);
    }
  }

  private async executeJob(job: AgentJob): Promise<void> {
    try {
      await job.execute(job.abortController.signal);
      job.status = "done";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // cancelled — don't mark as error
      } else {
        job.status = "error";
        job.error = err instanceof Error ? err.message : "Unknown error";
      }
    } finally {
      this.running.delete(job.id);
      this.notify();
      this.processNext();
    }
  }
}

export const agentQueue = new AgentQueue();
