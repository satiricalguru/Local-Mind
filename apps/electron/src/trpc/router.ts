import { HardwareDetector } from "../services/HardwareDetector.js";
import { DownloadManager } from "../services/DownloadManager.js";
import { DatabaseManager } from "../services/DatabaseManager.js";
import { registryModels } from "@localmind/registry-schema";
import { app, WebContents } from "electron";
import path from "path";
import fs from "fs";
import { Conversation, Message, ModelEntry, Generation } from "@localmind/shared-types";

export class IPCRouter {
  private activeModelId: string | null = null;
  private appDataPath: string;

  constructor(
    private db: DatabaseManager,
    private downloader: DownloadManager
  ) {
    this.appDataPath = path.join(app.getPath("home"), "LocalMind");
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

    // Initialize DownloadManager settings from database
    const settings = this.db.getSettings();
    if (settings.maxDownloads) {
      const limit = parseInt(settings.maxDownloads);
      if (!isNaN(limit)) {
        this.downloader.maxConcurrent = limit;
      }
    }

    // Set up download manager event bindings to push to renderer
    this.downloader.on("progress", (progress) => {
      this.broadcastToWindows("download-progress", progress);
    });

    this.downloader.on("completed", (job) => {
      // Add to database
      this.db.addInstalledModel({
        id: job.modelId,
        variantId: job.variantId,
        slug: job.modelId.split("/").pop() || "",
        name: job.modelId.split("/").pop() || "",
        category: this.inferCategory(job.modelId),
        filePath: job.destPath,
        sizeBytes: job.totalBytes,
        sha256: job.sha256,
        installedAt: Date.now(),
        metaJson: registryModels.find(m => m.id === job.modelId)
      });
      this.broadcastToWindows("download-completed", job);
    });
  }

  // Broadcaster references will be set by main process
  public webContentsProvider: () => WebContents[] = () => [];

  private broadcastToWindows(channel: string, data: any) {
    const contents = this.webContentsProvider();
    for (const wc of contents) {
      if (!wc.isDestroyed()) {
        wc.send(channel, data);
      }
    }
  }

  private inferCategory(modelId: string): string {
    const match = registryModels.find(m => m.id === modelId);
    return match ? match.category : "chat";
  }

  async handleRequest(channel: string, payload: any): Promise<any> {
    const [domain, action] = channel.split(":");

    try {
      switch (domain) {
        case "hardware":
          return await this.handleHardware(action, payload);
        case "models":
          return await this.handleModels(action, payload);
        case "downloads":
          return await this.handleDownloads(action, payload);
        case "conversations":
          return await this.handleConversations(action, payload);
        case "settings":
          return await this.handleSettings(action, payload);
        case "inference":
          return await this.handleInference(action, payload);
        case "generations":
          return await this.handleGenerations(action, payload);
        default:
          throw new Error(`Unknown IPC domain: ${domain}`);
      }
    } catch (err: any) {
      console.error(`Error handling IPC request [${channel}]:`, err);
      return { error: err.message || "Internal server error" };
    }
  }

  // --- Hardware Handlers ---
  private async handleHardware(action: string, payload: any) {
    if (action === "getProfile") {
      return await HardwareDetector.getProfile();
    }
    if (action === "getLiveStats") {
      const profile = await HardwareDetector.getProfile();
      return await HardwareDetector.getLiveStats(profile);
    }
    throw new Error(`Action ${action} not found on hardware domain`);
  }

  // --- Models Handlers ---
  private async handleModels(action: string, payload: any) {
    if (action === "getRegistry") {
      const installed = this.db.getInstalledModels();
      return registryModels.map(m => {
        const isInst = installed.some(i => i.id === m.id);
        const activeDownload = this.downloader.getJobs().find(j => j.modelId === m.id);
        return {
          ...m,
          installed: isInst,
          downloadStatus: activeDownload ? activeDownload.status : undefined,
          downloadProgress: activeDownload ? activeDownload.downloadedBytes / activeDownload.totalBytes : undefined
        };
      });
    }
    if (action === "getInstalled") {
      return this.db.getInstalledModels();
    }
    if (action === "removeModel") {
      const { id } = payload;
      const models = this.db.getInstalledModels();
      const model = models.find(m => m.id === id);
      if (model && fs.existsSync(model.filePath)) {
        try {
          fs.unlinkSync(model.filePath);
        } catch (e) {}
      }
      this.db.removeInstalledModel(id);
      return { success: true };
    }
    throw new Error(`Action ${action} not found on models domain`);
  }

  // --- Downloads Handlers ---
  private async handleDownloads(action: string, payload: any) {
    if (action === "getQueue") {
      return this.downloader.getJobs();
    }
    if (action === "enqueue") {
      const { modelId, variantId } = payload;
      const model = registryModels.find(m => m.id === modelId);
      if (!model) throw new Error("Model not found in registry");
      const variant = model.variants.find(v => v.id === variantId);
      if (!variant) throw new Error("Variant not found in registry");

      const settings = this.db.getSettings();
      let storageDir = settings.downloadPath;
      if (!storageDir) {
        storageDir = path.join(this.appDataPath, "models");
      } else {
        if (storageDir.startsWith("~/")) {
          storageDir = path.join(app.getPath("home"), storageDir.substring(2));
        } else if (storageDir === "~") {
          storageDir = app.getPath("home");
        }
      }
      const modelsDir = path.join(storageDir, model.category);

      return this.downloader.enqueue(
        modelId,
        variantId,
        variant.downloadUrl,
        variant.filename,
        variant.sizeGB,
        variant.sha256,
        modelsDir
      );
    }
    if (action === "pause") {
      this.downloader.pause(payload.id);
      return { success: true };
    }
    if (action === "resume") {
      this.downloader.resume(payload.id);
      return { success: true };
    }
    if (action === "cancel") {
      this.downloader.cancel(payload.id);
      return { success: true };
    }
    throw new Error(`Action ${action} not found on downloads domain`);
  }

  // --- Conversations Handlers ---
  private async handleConversations(action: string, payload: any) {
    if (action === "list") {
      return this.db.getConversations();
    }
    if (action === "create") {
      const conv: Conversation = {
        id: Math.random().toString(36).substring(2, 11),
        title: payload.title || "New Chat",
        modelId: payload.modelId,
        systemPrompt: payload.systemPrompt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        workspaceId: payload.workspaceId
      };
      this.db.createConversation(conv);
      return conv;
    }
    if (action === "update") {
      const { id, updates } = payload;
      this.db.updateConversation(id, updates);
      return { success: true };
    }
    if (action === "delete") {
      this.db.deleteConversation(payload.id);
      return { success: true };
    }
    if (action === "getMessages") {
      return this.db.getMessages(payload.conversationId);
    }
    if (action === "addMessage") {
      const msg: Message = {
        id: Math.random().toString(36).substring(2, 11),
        conversationId: payload.conversationId,
        role: payload.role,
        content: payload.content,
        parentId: payload.parentId,
        branchId: payload.branchId,
        modelId: payload.modelId,
        stats: payload.stats,
        createdAt: Date.now(),
        liked: payload.liked
      };
      this.db.addMessage(msg);
      return msg;
    }
    throw new Error(`Action ${action} not found on conversations domain`);
  }

  // --- Settings Handlers ---
  private async handleSettings(action: string, payload: any) {
    if (action === "getAll") {
      return this.db.getSettings();
    }
    if (action === "set") {
      this.db.setSetting(payload.key, payload.value);
      if (payload.key === "maxDownloads") {
        const limit = parseInt(payload.value);
        if (!isNaN(limit)) {
          this.downloader.maxConcurrent = limit;
        }
      }
      return { success: true };
    }
    throw new Error(`Action ${action} not found on settings domain`);
  }

  // --- Generations Handlers ---
  private async handleGenerations(action: string, payload: any) {
    if (action === "list") {
      return this.db.getGenerations(payload.category);
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
      this.db.addGeneration(g);
      return g;
    }
    if (action === "delete") {
      const { id } = payload;
      const generations = this.db.getGenerations();
      const gen = generations.find(g => g.id === id);
      if (gen && gen.outputPath && fs.existsSync(gen.outputPath)) {
        try {
          fs.unlinkSync(gen.outputPath);
        } catch (e) {}
      }
      this.db.deleteGeneration(id);
      return { success: true };
    }
    throw new Error(`Action ${action} not found on generations domain`);
  }

  // --- Inference / Model Running Simulator ---
  private async handleInference(action: string, payload: any) {
    if (action === "loadModel") {
      this.activeModelId = payload.modelId;
      return { success: true, modelId: payload.modelId };
    }
    if (action === "unloadModel") {
      this.activeModelId = null;
      return { success: true };
    }
    if (action === "getLoadedModel") {
      return { modelId: this.activeModelId };
    }

    // Chat completion streaming mock (returns realistic typed-out replies)
    if (action === "streamCompletion") {
      const { conversationId, messages, modelId } = payload;
      const lastUserMsg = messages[messages.length - 1]?.content || "";

      // Start inference metrics
      const startTime = Date.now();
      const ttft = Math.round(150 + Math.random() * 200); // 150-350ms TTFT

      // Read settings for backend override
      const settings = this.db.getSettings();
      const override = settings.backendOverride || "auto";
      let backendDesc = "";
      let delayMs = 50;

      if (override === "cpu") {
        backendDesc = "CPU threads only (forced)";
        delayMs = 150; // slow down word streaming (simulating CPU overhead)
      } else if (override === "vulkan") {
        backendDesc = "Vulkan driver API runtime (forced)";
        delayMs = 80;  // slightly slower than metal/cuda
      } else {
        backendDesc = process.platform === "darwin" ? "Apple Metal GPU" : "Vulkan/CUDA driver";
      }

      // Construct a response based on keywords or default assistant text
      let responseText = "I am a local AI assistant running on your machine.";
      const query = lastUserMsg.toLowerCase();

      if (query.includes("recursion")) {
        responseText = "Recursion is a programming concept where a function calls itself to solve a smaller instance of the same problem.\n\nHere is a simple example in Python:\n```python\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n```\nEvery recursive call requires a base case to prevent stack overflow. On your machine, memory limits are checked to prevent OOM.";
      } else if (query.includes("code") || query.includes("javascript") || query.includes("python")) {
        responseText = "Here is a code snippet demonstrating modern layout with Tailwind and React:\n```tsx\nimport React from 'react';\n\nexport const Card = ({ title }) => {\n  return (\n    <div className=\"bg-surface border border-border p-4 rounded-md shadow-lg\">\n      <h3 className=\"text-text-primary font-bold\">{title}</h3>\n    </div>\n  );\n};\n```";
      } else if (query.includes("who are you") || query.includes("localmind")) {
        responseText = "I am **LocalMind**, your local model companion. I run 100% locally on your system, protecting your privacy. I compile benchmarks, run STT/TTS transcriptions, and execute code within your safety sandbox.";
      } else {
        responseText = `This is a simulated token streaming response from **${modelId.split("/").pop()}** running locally via llama.cpp.\n\nYour system is currently utilizing the ${backendDesc} to offload model weights. The context length is configured to 8k tokens. Let me know how I can assist you with coding, analysis, or design!`;
      }

      // Stream tokens step by step
      const words = responseText.split(" ");
      let index = 0;
      
      const interval = setInterval(() => {
        if (index >= words.length) {
          clearInterval(interval);
          const totalTime = Date.now() - startTime;
          const tokens = words.length * 1.3; // rough estimation
          const tps = Math.round((tokens / (totalTime / 1000)) * 10) / 10;

          // Save completed message to DB
          const assistantMsg: Message = {
            id: Math.random().toString(36).substring(2, 11),
            conversationId,
            role: "assistant",
            content: responseText,
            modelId,
            stats: {
              tps,
              ttft,
              tokens: Math.round(tokens)
            },
            createdAt: Date.now()
          };
          this.db.addMessage(assistantMsg);

          this.broadcastToWindows("chat-stream-done", {
            conversationId,
            message: assistantMsg
          });
        } else {
          const chunk = words[index] + (index === words.length - 1 ? "" : " ");
          this.broadcastToWindows("chat-stream-chunk", {
            conversationId,
            text: chunk
          });
          index++;
        }
      }, delayMs);

      return { success: true };
    }

    // Image gen mock (writes a canvas graphic to file to show output in playground)
    if (action === "generateImage") {
      const { prompt, modelId } = payload;
      const imageDir = path.join(this.appDataPath, "generations", "images");
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      // Generate a mock unique SVG representing a beautiful art piece
      const filename = `gen-${Date.now()}.png`;
      const filePath = path.join(imageDir, filename);

      // Create an actual dummy PNG text file, but in web app we render a beautiful canvas graphic.
      // We will also return metadata.
      fs.writeFileSync(filePath, `IMAGE:${prompt}`);

      const g = {
        id: Math.random().toString(36).substring(2, 11),
        category: "image-gen" as const,
        modelId,
        prompt,
        paramsJson: JSON.stringify(payload.params || {}),
        outputPath: filePath,
        thumbnailPath: filePath,
        seed: Math.floor(Math.random() * 999999),
        favorite: false,
        createdAt: Date.now()
      };
      this.db.addGeneration(g);
      return g;
    }

    if (action === "generateAudio") {
      const { prompt, modelId, params } = payload;
      const audioDir = path.join(this.appDataPath, "generations", "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      const filename = `audio-${Date.now()}.wav`;
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, `AUDIO:${prompt}`);

      const duration = typeof params?.duration === "number" ? params.duration : 8;
      const seed = typeof params?.seed === "number" ? params.seed : 42;

      const g = {
        id: Math.random().toString(36).substring(2, 11),
        category: "audio-gen" as const,
        modelId,
        prompt,
        paramsJson: JSON.stringify(params || {}),
        outputPath: filePath,
        thumbnailPath: "",
        durationMs: duration * 1000,
        seed: seed,
        favorite: false,
        createdAt: Date.now()
      };
      this.db.addGeneration(g);
      return g;
    }

    if (action === "speak") {
      const { text, modelId, voice } = payload;
      const ttsDir = path.join(this.appDataPath, "generations", "tts");
      if (!fs.existsSync(ttsDir)) {
        fs.mkdirSync(ttsDir, { recursive: true });
      }
      const filename = `tts-${Date.now()}.mp3`;
      const filePath = path.join(ttsDir, filename);
      fs.writeFileSync(filePath, `TTS:${text}`);

      const g = {
        id: Math.random().toString(36).substring(2, 11),
        category: "tts" as const,
        modelId,
        prompt: text,
        paramsJson: JSON.stringify({ voice }),
        outputPath: filePath,
        thumbnailPath: "",
        durationMs: Math.round(text.length * 80),
        favorite: false,
        createdAt: Date.now()
      };
      this.db.addGeneration(g);
      return g;
    }

    if (action === "transcribe") {
      const { audioPath, modelId, fileName, isLiveMic } = payload;
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
      const prefix = fileName && !isLiveMic ? `[${fileName}] ` : "";
      return {
        text: prefix + picked.text,
        segments: picked.segments
      };
    }

    throw new Error(`Action ${action} not found on inference domain`);
  }
}
