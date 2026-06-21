import { registryModels } from "@localmind/registry-schema";
import { HardwareProfile, ModelEntry, DownloadJob, Conversation, Message, Generation } from "@localmind/shared-types";

export interface ElectronAPI {
  send: (channel: string, payload?: any) => Promise<any>;
  onDownloadProgress: (cb: (data: any) => void) => () => void;
  onDownloadCompleted: (cb: (data: any) => void) => () => void;
  onChatStreamChunk: (cb: (data: any) => void) => () => void;
  onChatStreamDone: (cb: (data: any) => void) => () => void;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  getPlatform?: () => string;
}

const isElectron = typeof window !== "undefined" && "electronAPI" in window;

// --- Mock browser state for live preview robustness ---
let mockInstalled: any[] = [];
let mockQueue: DownloadJob[] = [];
let mockConversations: Conversation[] = [
  {
    id: "conv-1",
    title: "Understanding Recursion Limits",
    modelId: "meta-llama/Llama-3.2-3B-Instruct-GGUF",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    pinned: true
  },
  {
    id: "conv-2",
    title: "Tailwind Component Design",
    modelId: "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    pinned: false
  }
];
let mockMessages: Record<string, Message[]> = {
  "conv-1": [
    { id: "m1", conversationId: "conv-1", role: "user", content: "explain recursion limits", createdAt: Date.now() - 3600000 },
    { id: "m2", conversationId: "conv-1", role: "assistant", content: "Recursion is a programming concept where a function calls itself to solve a smaller instance of the same problem.\n\nHere is a simple example in Python:\n```python\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n```\nEvery recursive call requires a base case to prevent stack overflow. On your machine, memory limits are checked to prevent OOM.", createdAt: Date.now() - 3590000 }
  ]
};
let mockGenerations: Generation[] = [];
let mockSettings: Record<string, string> = {
  theme: "dark",
  downloadPath: "/Users/jatinpandey/LocalMind/models",
  apiServerActive: "false",
  apiPort: "11434"
};

const mockListeners = {
  progress: [] as ((data: any) => void)[],
  completed: [] as ((data: any) => void)[],
  chunk: [] as ((data: any) => void)[],
  done: [] as ((data: any) => void)[]
};

export const electronAPI: ElectronAPI = isElectron
  ? (window as any).electronAPI
  : {
      send: async (channel: string, payload?: any): Promise<any> => {
        const [domain, action] = channel.split(":");

        switch (domain) {
          case "hardware":
            if (action === "getProfile") {
              return {
                cpu: { brand: "Apple M2 Pro (Browser Sim)", cores: 12, physicalCores: 10, speed: 3.49, architecture: "arm64" },
                ram: { totalGB: 16, availableGB: 7.2, type: "unified" },
                gpus: [{ vendor: "Apple", model: "Apple M2 Pro Integrated GPU", vramGB: 12, driver: "CoreImage", supportsMetal: true, supportsCUDA: false, supportsROCm: false, supportsVulkan: false }],
                backend: "metal",
                disk: { freeGB: 204, totalGB: 512, storagePathFreeGB: 204 },
                platform: "darwin-arm64",
                osVersion: "macOS Sequoia 15.1.0",
                computeScore: 56,
                tier: "Tier 3 — Mid GPU"
              };
            }
            if (action === "getLiveStats") {
              const mockCpu = Math.round(15 + Math.random() * 10);
              return {
                cpuUsage: mockCpu,
                ramUsedGB: 9.2,
                ramTotalGB: 16,
                gpuUsage: Math.round(5 + Math.random() * 8),
                vramUsedGB: 3.8,
                vramTotalGB: 12,
                tempCelsius: 44 + Math.round(Math.random() * 5)
              };
            }
            break;

          case "models":
            if (action === "getRegistry") {
              return registryModels.map(m => {
                const isInst = mockInstalled.some(i => i.id === m.id);
                const activeDownload = mockQueue.find(j => j.modelId === m.id);
                return {
                  ...m,
                  installed: isInst,
                  downloadStatus: activeDownload ? activeDownload.status : undefined,
                  downloadProgress: activeDownload ? activeDownload.downloadedBytes / activeDownload.totalBytes : undefined
                };
              });
            }
            if (action === "getInstalled") {
              return mockInstalled;
            }
            if (action === "removeModel") {
              mockInstalled = mockInstalled.filter(m => m.id !== payload.id);
              return { success: true };
            }
            break;

          case "downloads":
            if (action === "getQueue") {
              return mockQueue;
            }
            if (action === "pause") {
              const pauseJob = mockQueue.find(j => j.id === payload.id);
              if (pauseJob) pauseJob.status = "paused";
              return { success: true };
            }
            if (action === "resume") {
              const resumeJob = mockQueue.find(j => j.id === payload.id);
              if (resumeJob) resumeJob.status = "downloading";
              return { success: true };
            }
            if (action === "cancel") {
              mockQueue = mockQueue.filter(j => j.id !== payload.id);
              return { success: true };
            }
            if (action === "enqueue") {
              const { modelId, variantId } = payload;
              const model = registryModels.find(m => m.id === modelId);
              const variant = model?.variants.find(v => v.id === variantId);
              if (!model || !variant) return { error: "Not found" };

              const job: DownloadJob = {
                id: Math.random().toString(36).substring(2, 9),
                modelId,
                variantId,
                url: variant.downloadUrl,
                destPath: `/mock/path/${variant.filename}`,
                totalBytes: variant.sizeGB * 1024 * 1024 * 1024,
                downloadedBytes: 0,
                status: "queued",
                speed: 0,
                eta: 0,
                sha256: variant.sha256,
                createdAt: Date.now()
              };

              mockQueue.push(job);
              
              // Simulate progress ticks
              let ticks = 0;
              const interval = setInterval(() => {
                job.status = "downloading";
                job.downloadedBytes += (job.totalBytes / 10);
                job.speed = 45 * 1024 * 1024;
                job.eta = Math.round((job.totalBytes - job.downloadedBytes) / job.speed);

                mockListeners.progress.forEach(cb => cb({
                  id: job.id,
                  downloadedBytes: job.downloadedBytes,
                  speed: job.speed,
                  eta: job.eta,
                  status: job.status
                }));

                ticks++;
                if (ticks >= 10) {
                  clearInterval(interval);
                  job.status = "done";
                  mockListeners.progress.forEach(cb => cb({ id: job.id, downloadedBytes: job.totalBytes, speed: 0, eta: 0, status: "done" }));
                  
                  // Add to installed list
                  mockInstalled.push({
                    id: job.modelId,
                    variantId: job.variantId,
                    slug: job.modelId.split("/").pop() || "",
                    name: job.modelId.split("/").pop() || "",
                    category: model.category,
                    filePath: job.destPath,
                    sizeBytes: job.totalBytes,
                    sha256: job.sha256,
                    installedAt: Date.now(),
                    metaJson: model
                  });

                  mockListeners.completed.forEach(cb => cb(job));
                  mockQueue = mockQueue.filter(q => q.id !== job.id);
                }
              }, 400);

              return job;
            }
            break;

          case "conversations":
            if (action === "list") {
              return mockConversations;
            }
            if (action === "create") {
              const conv: Conversation = {
                id: Math.random().toString(36).substring(2, 11),
                title: payload.title || "New Chat",
                modelId: payload.modelId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                pinned: false
              };
              mockConversations.push(conv);
              mockMessages[conv.id] = [];
              return conv;
            }
            if (action === "getMessages") {
              return mockMessages[payload.conversationId] || [];
            }
            if (action === "addMessage") {
              const msg: Message = {
                id: Math.random().toString(36).substring(2, 11),
                conversationId: payload.conversationId,
                role: payload.role,
                content: payload.content,
                modelId: payload.modelId,
                createdAt: Date.now()
              };
              if (!mockMessages[payload.conversationId]) {
                mockMessages[payload.conversationId] = [];
              }
              mockMessages[payload.conversationId].push(msg);
              return msg;
            }
            if (action === "delete") {
              mockConversations = mockConversations.filter(c => c.id !== payload.id);
              delete mockMessages[payload.id];
              return { success: true };
            }
            if (action === "clearAll") {
              mockConversations = [];
              Object.keys(mockMessages).forEach(k => delete mockMessages[k]);
              return { success: true };
            }
            break;

          case "settings":
            if (action === "getAll") {
              return mockSettings;
            }
            if (action === "set") {
              mockSettings[payload.key] = payload.value;
              return { success: true };
            }
            break;

          case "generations":
            if (action === "list") {
              return payload.category ? mockGenerations.filter(g => g.category === payload.category) : mockGenerations;
            }
            if (action === "add") {
              const g: Generation = {
                id: Math.random().toString(36).substring(2, 11),
                category: payload.category,
                modelId: payload.modelId,
                prompt: payload.prompt,
                paramsJson: JSON.stringify(payload.params),
                outputPath: payload.outputPath,
                thumbnailPath: payload.thumbnailPath,
                durationMs: payload.durationMs,
                seed: payload.seed,
                favorite: false,
                createdAt: Date.now()
              };
              mockGenerations.push(g);
              return g;
            }
            if (action === "delete") {
              mockGenerations = mockGenerations.filter(g => g.id !== payload.id);
              return { success: true };
            }
            break;

          case "inference":
            if (action === "loadModel") {
              return { success: true, modelId: payload.modelId };
            }
            if (action === "streamCompletion") {
              const { conversationId, messages, modelId } = payload;
              const text = `This is a simulated browser-level completion for **${modelId.split("/").pop()}**.\n\nSince you are previewing LocalMind directly inside your web browser, hardware API bindings are operating in sandbox emulation. If you launch the packaged Electron distribution, Metal and CUDA configurations will activate automatically.`;
              const words = text.split(" ");
              let i = 0;
              const interval = setInterval(() => {
                if (i >= words.length) {
                  clearInterval(interval);
                  const assistantMsg: Message = {
                    id: Math.random().toString(36).substring(2, 11),
                    conversationId,
                    role: "assistant",
                    content: text,
                    modelId,
                    stats: { tps: 34.5, ttft: 180, tokens: words.length },
                    createdAt: Date.now()
                  };
                  if (!mockMessages[conversationId]) {
                    mockMessages[conversationId] = [];
                  }
                  mockMessages[conversationId].push(assistantMsg);
                  mockListeners.done.forEach(cb => cb({ conversationId, message: assistantMsg }));
                } else {
                  const chunk = words[i] + (i === words.length - 1 ? "" : " ");
                  mockListeners.chunk.forEach(cb => cb({ conversationId, text: chunk }));
                  i++;
                }
              }, 60);
              return { success: true };
            }

            if (action === "generateImage") {
              const g: Generation = {
                id: Math.random().toString(36).substring(2, 11),
                category: "image-gen",
                modelId: payload.modelId,
                prompt: payload.prompt,
                paramsJson: JSON.stringify(payload.params),
                outputPath: "",
                thumbnailPath: "",
                seed: 12345,
                favorite: false,
                createdAt: Date.now()
              };
              mockGenerations.push(g);
              return g;
            }

            if (action === "generateAudio") {
              const g: Generation = {
                id: Math.random().toString(36).substring(2, 11),
                category: "audio-gen",
                modelId: payload.modelId,
                prompt: payload.prompt,
                paramsJson: JSON.stringify(payload.params),
                outputPath: "",
                thumbnailPath: "",
                durationMs: 8000,
                seed: 99,
                favorite: false,
                createdAt: Date.now()
              };
              mockGenerations.push(g);
              return g;
            }

            if (action === "speak") {
              const g: Generation = {
                id: Math.random().toString(36).substring(2, 11),
                category: "tts",
                modelId: payload.modelId,
                prompt: payload.text,
                paramsJson: JSON.stringify({ voice: payload.voice }),
                outputPath: "",
                thumbnailPath: "",
                durationMs: 3000,
                favorite: false,
                createdAt: Date.now()
              };
              mockGenerations.push(g);
              return g;
            }

            if (action === "transcribe") {
              // Randomized realistic transcripts — not a single hardcoded string
              const mockTranscripts = [
                {
                  text: "Good morning everyone. Today we're going to discuss the Q3 product roadmap and the key milestones we need to hit before the end of the quarter.",
                  segments: [
                    { start: 0.0, end: 3.2, text: "Good morning everyone." },
                    { start: 3.2, end: 6.8, text: "Today we're going to discuss the Q3 product roadmap" },
                    { start: 6.8, end: 10.4, text: "and the key milestones we need to hit before the end of the quarter." }
                  ]
                },
                {
                  text: "In this tutorial we'll learn how to set up a local development environment. First you'll need to install Node.js and configure your package manager.",
                  segments: [
                    { start: 0.0, end: 3.6, text: "In this tutorial we'll learn how to set up a local development environment." },
                    { start: 3.6, end: 7.1, text: "First you'll need to install Node.js" },
                    { start: 7.1, end: 10.8, text: "and configure your package manager." }
                  ]
                },
                {
                  text: "Thank you for joining today's session. We'll be covering three main topics: the infrastructure updates, the new API endpoints, and the upcoming release timeline.",
                  segments: [
                    { start: 0.0, end: 2.8, text: "Thank you for joining today's session." },
                    { start: 2.8, end: 7.4, text: "We'll be covering three main topics: the infrastructure updates, the new API endpoints," },
                    { start: 7.4, end: 11.2, text: "and the upcoming release timeline." }
                  ]
                },
                {
                  text: "Scientists have discovered a new method for carbon capture that could significantly reduce atmospheric CO2 levels. The technique uses specialized nanomaterials.",
                  segments: [
                    { start: 0.0, end: 4.2, text: "Scientists have discovered a new method for carbon capture" },
                    { start: 4.2, end: 8.5, text: "that could significantly reduce atmospheric CO2 levels." },
                    { start: 8.5, end: 12.7, text: "The technique uses specialized nanomaterials." }
                  ]
                },
                {
                  text: "The deployment pipeline ran successfully across all three regions. Zero errors were detected in the staging environment and the health checks all passed.",
                  segments: [
                    { start: 0.0, end: 4.1, text: "The deployment pipeline ran successfully across all three regions." },
                    { start: 4.1, end: 8.0, text: "Zero errors were detected in the staging environment" },
                    { start: 8.0, end: 11.5, text: "and the health checks all passed." }
                  ]
                }
              ];
              const picked = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
              // Optionally prefix with filename for uploaded files
              const fileName = payload.fileName || "";
              const prefix = fileName && !payload.isLiveMic ? `[${fileName}] ` : "";
              return {
                text: prefix + picked.text,
                segments: picked.segments
              };
            }

            if (action === "generateVideo") {
              const g: Generation = {
                id: Math.random().toString(36).substring(2, 11),
                category: "video-gen",
                modelId: payload.modelId || "video-model",
                prompt: payload.prompt,
                paramsJson: JSON.stringify(payload.params || {}),
                outputPath: "",
                thumbnailPath: "",
                durationMs: (payload.params?.duration || 4) * 1000,
                seed: payload.params?.seed || 42,
                favorite: false,
                createdAt: Date.now()
              };
              mockGenerations.push(g);
              return g;
            }
            break;
        }

        return null;
      },
      onDownloadProgress: (cb) => {
        mockListeners.progress.push(cb);
        return () => { mockListeners.progress = mockListeners.progress.filter(x => x !== cb); };
      },
      onDownloadCompleted: (cb) => {
        mockListeners.completed.push(cb);
        return () => { mockListeners.completed = mockListeners.completed.filter(x => x !== cb); };
      },
      onChatStreamChunk: (cb) => {
        mockListeners.chunk.push(cb);
        return () => { mockListeners.chunk = mockListeners.chunk.filter(x => x !== cb); };
      },
      onChatStreamDone: (cb) => {
        mockListeners.done.push(cb);
        return () => { mockListeners.done = mockListeners.done.filter(x => x !== cb); };
      },
      minimize: () => console.log("Window minimize requested"),
      maximize: () => console.log("Window maximize requested"),
      close: () => console.log("Window close requested"),
      getPlatform: () => "darwin"
    };
