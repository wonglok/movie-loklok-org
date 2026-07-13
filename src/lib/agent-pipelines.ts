import { agentQueue, type AgentType, type AgentJob } from "./agent-queue";

export interface PipelineStep {
  agentType: AgentType;
  jobFactory: () => AgentJob[];
  dependsOn: number | null;
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
}

export async function runPipeline(pipeline: Pipeline): Promise<void> {
  const stepResults: Map<number, Promise<void>> = new Map();

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];

    // Wait for dependency step to complete
    if (step.dependsOn !== null) {
      const depPromise = stepResults.get(step.dependsOn);
      if (depPromise) {
        await depPromise;
      }
    }

    // Enqueue all jobs for this step and track their completion
    const jobs = step.jobFactory();
    const jobPromises = jobs.map((job) => {
      return new Promise<void>((resolve, reject) => {
        const originalExecute = job.execute;
        job.execute = async (signal) => {
          try {
            await originalExecute(signal);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        agentQueue.enqueue(job);
      });
    });

    stepResults.set(i, Promise.all(jobPromises).then(() => {}));
  }
}

export function createJob(
  type: AgentType,
  projectId: string,
  targetId: string,
  targetName: string,
  priority: number,
  execute: (signal: AbortSignal) => Promise<void>,
): AgentJob {
  return {
    id: crypto.randomUUID(),
    type,
    projectId,
    targetId,
    targetName,
    priority,
    status: "pending",
    execute,
    abortController: new AbortController(),
  };
}

// Pre-defined pipeline factories

export function fullMoviePipeline(
  projectId: string,
  characters: { id: string; name: string }[],
  scenes: { id: string; name: string }[],
  generateCharacterImage: (charId: string, signal: AbortSignal) => Promise<void>,
  generateSceneImage: (sceneId: string, signal: AbortSignal) => Promise<void>,
  generateSceneScript: (sceneId: string, signal: AbortSignal) => Promise<void>,
  generateSceneVideo: (sceneId: string, signal: AbortSignal) => Promise<void>,
): Pipeline {
  return {
    id: crypto.randomUUID(),
    name: "Full Movie Pipeline",
    steps: [
      {
        agentType: "character-image",
        dependsOn: null,
        jobFactory: () =>
          characters.map((c) =>
            createJob("character-image", projectId, c.id, c.name, 10, (signal) =>
              generateCharacterImage(c.id, signal),
            ),
          ),
      },
      {
        agentType: "scene-image",
        dependsOn: 0,
        jobFactory: () =>
          scenes.map((s) =>
            createJob("scene-image", projectId, s.id, s.name, 10, (signal) =>
              generateSceneImage(s.id, signal),
            ),
          ),
      },
      {
        agentType: "script",
        dependsOn: 1,
        jobFactory: () =>
          scenes.map((s) =>
            createJob("script", projectId, s.id, s.name, 10, (signal) =>
              generateSceneScript(s.id, signal),
            ),
          ),
      },
      {
        agentType: "scene-video",
        dependsOn: 2,
        jobFactory: () =>
          scenes.map((s) =>
            createJob("scene-video", projectId, s.id, s.name, 10, (signal) =>
              generateSceneVideo(s.id, signal),
            ),
          ),
      },
    ],
  };
}

export function scenePipeline(
  projectId: string,
  sceneId: string,
  sceneName: string,
  generateImage: (signal: AbortSignal) => Promise<void>,
  generateScript: (signal: AbortSignal) => Promise<void>,
  generateVideo: (signal: AbortSignal) => Promise<void>,
): Pipeline {
  return {
    id: crypto.randomUUID(),
    name: `Scene Pipeline: ${sceneName}`,
    steps: [
      {
        agentType: "scene-image",
        dependsOn: null,
        jobFactory: () => [
          createJob("scene-image", projectId, sceneId, sceneName, 5, generateImage),
        ],
      },
      {
        agentType: "script",
        dependsOn: 0,
        jobFactory: () => [
          createJob("script", projectId, sceneId, sceneName, 5, generateScript),
        ],
      },
      {
        agentType: "scene-video",
        dependsOn: 1,
        jobFactory: () => [
          createJob("scene-video", projectId, sceneId, sceneName, 5, generateVideo),
        ],
      },
    ],
  };
}
