import { EventEmitter } from "events";
import { DownloadJob, DownloadProgress } from "@localmind/shared-types";
import path from "path";
import fs from "fs";

export class DownloadManager extends EventEmitter {
  private queue: DownloadJob[] = [];
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();
  public maxConcurrent: number = 2;

  constructor() {
    super();
  }

  getJobs(): DownloadJob[] {
    return this.queue;
  }

  enqueue(modelId: string, variantId: string, url: string, filename: string, totalSizeGB: number, sha256: string, storageDir: string): DownloadJob {
    // Check if job already exists
    const existing = this.queue.find(j => j.variantId === variantId);
    if (existing) {
      return existing;
    }

    const destPath = path.join(storageDir, filename);
    const totalBytes = Math.round(totalSizeGB * 1024 * 1024 * 1024);

    const job: DownloadJob = {
      id: Math.random().toString(36).substring(2, 9),
      modelId,
      variantId,
      url,
      destPath,
      totalBytes,
      downloadedBytes: 0,
      status: "queued",
      speed: 0,
      eta: 0,
      sha256,
      createdAt: Date.now()
    };

    this.queue.push(job);
    this.processQueue();
    return job;
  }

  pause(jobId: string) {
    const job = this.queue.find(j => j.id === jobId);
    if (job && job.status === "downloading") {
      job.status = "paused";
      job.speed = 0;
      const interval = this.activeJobs.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.activeJobs.delete(jobId);
      }
      this.emitProgress(jobId);
      this.processQueue();
    }
  }

  resume(jobId: string) {
    const job = this.queue.find(j => j.id === jobId);
    if (job && job.status === "paused") {
      job.status = "queued";
      this.emitProgress(jobId);
      this.processQueue();
    }
  }

  cancel(jobId: string) {
    const jobIndex = this.queue.findIndex(j => j.id === jobId);
    if (jobIndex > -1) {
      const job = this.queue[jobIndex];
      const interval = this.activeJobs.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.activeJobs.delete(jobId);
      }
      // Delete incomplete file if it exists
      try {
        if (fs.existsSync(job.destPath) && job.status !== "done") {
          fs.unlinkSync(job.destPath);
        }
      } catch (e) {}

      this.queue.splice(jobIndex, 1);
      this.emit("cancelled", jobId);
      this.processQueue();
    }
  }

  private processQueue() {
    const activeCount = Array.from(this.queue.values()).filter(j => j.status === "downloading").length;
    if (activeCount >= this.maxConcurrent) return;

    const nextJob = this.queue.find(j => j.status === "queued");
    if (nextJob) {
      this.startDownload(nextJob);
    }
  }

  private startDownload(job: DownloadJob) {
    job.status = "downloading";
    this.emitProgress(job.id);

    // Mock/Simulated chunk downloader for rapid testing/onboarding demo
    // Generates 15-40 MB/s download speed, completing in about 8-15 seconds
    const chunkSize = 40 * 1024 * 1024; // 40MB chunks
    const tickMs = 300;

    const interval = setInterval(() => {
      if (job.status !== "downloading") {
        clearInterval(interval);
        return;
      }

      const increment = Math.round(chunkSize * (0.8 + Math.random() * 0.4));
      job.downloadedBytes += increment;
      job.speed = Math.round(increment / (tickMs / 1000)); // bytes/sec

      if (job.downloadedBytes >= job.totalBytes) {
        job.downloadedBytes = job.totalBytes;
        job.speed = 0;
        job.eta = 0;
        job.status = "verifying";
        this.emitProgress(job.id);
        clearInterval(interval);
        this.activeJobs.delete(job.id);

        // Verify Checksum simulation
        setTimeout(() => {
          job.status = "done";
          job.completedAt = Date.now();
          this.emitProgress(job.id);
          this.emit("completed", job);
          
          // Create dummy file representing downloaded model to satisfy file existence checks
          try {
            const dir = path.dirname(job.destPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(job.destPath, `LOCALMIND_MODEL_VARIANT:${job.variantId}`);
          } catch (err) {}

          this.processQueue();
        }, 1000);
      } else {
        const remainingBytes = job.totalBytes - job.downloadedBytes;
        job.eta = Math.round(remainingBytes / (job.speed || 1));
        this.emitProgress(job.id);
      }
    }, tickMs);

    this.activeJobs.set(job.id, interval);
  }

  private emitProgress(jobId: string) {
    const job = this.queue.find(j => j.id === jobId);
    if (job) {
      const progress: DownloadProgress = {
        id: job.id,
        downloadedBytes: job.downloadedBytes,
        speed: job.speed,
        eta: job.eta,
        status: job.status,
        error: job.error
      };
      this.emit("progress", progress);
    }
  }
}
