import { z } from "zod";

// --- Model Registry Types ---
export const ModelCategorySchema = z.enum([
  "chat",
  "code",
  "image-gen",
  "video-gen",
  "audio-gen",
  "tts",
  "stt",
  "vision",
  "embedding",
  "reranker"
]);
export type ModelCategory = z.infer<typeof ModelCategorySchema>;

export const ModelVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantization: z.string().optional(),
  sizeGB: z.number(),
  downloadUrl: z.string(),
  sha256: z.string(),
  filename: z.string(),
  contextLength: z.number().optional(),
  minVramGB: z.number(),
  recommended: z.boolean()
});
export type ModelVariant = z.infer<typeof ModelVariantSchema>;

export const ModelEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  author: z.string(),
  category: ModelCategorySchema,
  subcategory: z.string().optional(),
  description: z.string(),
  longDescription: z.string().optional(),
  tags: z.array(z.string()),
  license: z.string(),
  requiresAuth: z.boolean(),
  variants: z.array(ModelVariantSchema),
  minRequirements: z.object({
    ramGB: z.number(),
    vramGB: z.number(),
    diskGB: z.number(),
    backend: z.array(z.string())
  }),
  recommendedRequirements: z.object({
    ramGB: z.number(),
    vramGB: z.number()
  }),
  minComputeScore: z.number(),
  downloads: z.number(),
  likes: z.number(),
  rating: z.number().optional(),
  thumbnailUrl: z.string().optional(),
  demoVideoUrl: z.string().optional(),
  inferenceConfig: z.any().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  source: z.enum(["huggingface", "ollama", "civitai", "localmind"]),
  hfRepoId: z.string().optional(),
  ollamaTag: z.string().optional(),
  civitaiModelId: z.number().optional()
});
export type ModelEntry = z.infer<typeof ModelEntrySchema>;


// --- Hardware Profiler Types ---
export const HardwareProfileSchema = z.object({
  cpu: z.object({
    brand: z.string(),
    cores: z.number(),
    physicalCores: z.number(),
    speed: z.number(),
    architecture: z.enum(["arm64", "x64"])
  }),
  ram: z.object({
    totalGB: z.number(),
    availableGB: z.number(),
    type: z.enum(["LPDDR5", "DDR5", "DDR4", "unified", "unknown"])
  }),
  gpus: z.array(
    z.object({
      vendor: z.enum(["NVIDIA", "AMD", "Apple", "Intel", "Unknown"]),
      model: z.string(),
      vramGB: z.number(),
      driver: z.string(),
      supportsVulkan: z.boolean(),
      supportsMetal: z.boolean(),
      supportsCUDA: z.boolean(),
      supportsROCm: z.boolean()
    })
  ),
  backend: z.enum(["metal", "cuda", "rocm", "vulkan", "cpu"]),
  disk: z.object({
    freeGB: z.number(),
    totalGB: z.number(),
    storagePathFreeGB: z.number()
  }),
  platform: z.enum(["darwin-arm64", "darwin-x64", "win32-x64"]),
  osVersion: z.string(),
  computeScore: z.number(),
  tier: z.enum([
    "Tier 1 — CPU Only",
    "Tier 2 — Light GPU",
    "Tier 3 — Mid GPU",
    "Tier 4 — Power GPU",
    "Tier 5 — Workstation"
  ])
});
export type HardwareProfile = z.infer<typeof HardwareProfileSchema>;

export interface HardwareLiveStats {
  cpuUsage: number;
  ramUsedGB: number;
  ramTotalGB: number;
  gpuUsage?: number;
  vramUsedGB?: number;
  vramTotalGB?: number;
  tempCelsius?: number;
}


// --- Download Manager Types ---
export const DownloadJobSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  variantId: z.string(),
  url: z.string(),
  destPath: z.string(),
  totalBytes: z.number(),
  downloadedBytes: z.number(),
  status: z.enum(["queued", "downloading", "paused", "verifying", "done", "failed"]),
  error: z.string().optional(),
  speed: z.number(),
  eta: z.number(),
  sha256: z.string(),
  createdAt: z.number(),
  completedAt: z.number().optional()
});
export type DownloadJob = z.infer<typeof DownloadJobSchema>;

export interface DownloadProgress {
  id: string;
  downloadedBytes: number;
  speed: number;
  eta: number;
  status: DownloadJob["status"];
  error?: string;
}


// --- Chat/Playground Database Types ---
export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  workspaceId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parentId?: string;
  branchId?: string;
  modelId?: string;
  stats?: {
    tps: number;
    ttft: number;
    tokens: number;
  };
  createdAt: number;
  liked?: boolean;
}

export interface Generation {
  id: string;
  category: ModelCategory;
  modelId: string;
  prompt: string;
  paramsJson: string;
  outputPath?: string;
  thumbnailPath?: string;
  durationMs?: number;
  seed?: number;
  favorite: boolean;
  createdAt: number;
}

export interface BenchmarkResult {
  id: string;
  modelId: string;
  category: ModelCategory;
  timestamp: number;
  metrics: {
    tps?: number;
    ttft?: number;
    memoryGB?: number;
    wer?: number;
    durationRatio?: number;
  };
}
