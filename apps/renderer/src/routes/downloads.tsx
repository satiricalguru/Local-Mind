import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { 
  Download, 
  Play, 
  Pause, 
  X, 
  Clock, 
  Gauge, 
  CheckCircle
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { DownloadJob } from "@localmind/shared-types";
import { toast } from "sonner";

export const Route = createFileRoute("/downloads")({
  component: DownloadsPage
});

function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const navigate = useNavigate();

  const loadJobs = async () => {
    const data = await electronAPI.send("downloads:getQueue");
    setJobs(data || []);
  };

  useEffect(() => {
    loadJobs();

    // Bind progress listeners
    const unsubProgress = electronAPI.onDownloadProgress((data) => {
      setJobs(curr => curr.map(j => {
        if (j.id === data.id) {
          return { ...j, ...data };
        }
        return j;
      }));
    });

    const unsubCompleted = electronAPI.onDownloadCompleted(() => {
      loadJobs();
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  const handlePause = async (id: string) => {
    await electronAPI.send("downloads:pause", { id });
    loadJobs();
  };

  const handleResume = async (id: string) => {
    await electronAPI.send("downloads:resume", { id });
    loadJobs();
  };

  const handleCancel = async (id: string) => {
    await electronAPI.send("downloads:cancel", { id });
    loadJobs();
    toast.info("Download cancelled");
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return "0 KB/s";
    const mb = bytesPerSec / (1024 * 1024);
    return `${mb.toFixed(1)} MB/s`;
  };

  const formatETA = (seconds: number) => {
    if (seconds <= 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const activeJobs = jobs.filter(j => j.status !== "done");

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6 select-none">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Download className="w-5 h-5 text-accent" />
            <span>Download Queue</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">Monitor active model installations and chunk downloads.</p>
        </div>
      </div>

      {activeJobs.length > 0 ? (
        <div className="flex flex-col gap-4">
          {activeJobs.map((job) => {
            const percent = Math.round((job.downloadedBytes / job.totalBytes) * 100);
            
            return (
              <div 
                key={job.id} 
                className="glass-panel rounded-xl p-5 flex flex-col gap-4 border border-border hover:border-border-bright transition duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-text-primary">{job.modelId.split("/").pop()}</h3>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                      Variant ID: {job.variantId.split("-").pop()}
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold capitalize border ${
                    job.status === "downloading" ? "text-accent bg-accent/10 border-accent/30 animate-pulse" :
                    job.status === "paused" ? "text-warning bg-warning/10 border-warning/30" :
                    job.status === "verifying" ? "text-info bg-info/10 border-info/30" :
                    "text-text-muted bg-bg-subtle border-border"
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-text-secondary">
                    <span>{percent}% Complete</span>
                    <span>
                      {(job.downloadedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / {(job.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </span>
                  </div>
                  <div className="h-2 w-full bg-bg-base border border-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-text-secondary pt-2 border-t border-border/40">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-text-muted" />
                      {formatSpeed(job.speed)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-text-muted" />
                      ETA: {formatETA(job.eta)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {job.status === "downloading" ? (
                      <button 
                        onClick={() => handlePause(job.id)}
                        className="p-1 border border-border hover:border-border-bright rounded text-text-secondary hover:text-text-primary cursor-pointer transition"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : job.status === "paused" ? (
                      <button 
                        onClick={() => handleResume(job.id)}
                        className="p-1 border border-border hover:border-border-bright rounded text-text-secondary hover:text-text-primary cursor-pointer transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    <button 
                      onClick={() => handleCancel(job.id)}
                      className="p-1 border border-danger/30 hover:border-danger bg-danger/5 text-danger rounded cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <CheckCircle className="w-12 h-12 text-success" />
          <h3 className="font-bold text-sm text-text-primary">No active downloads</h3>
          <p className="text-xs text-text-secondary max-w-sm">All selected models are downloaded and verified ready for local playgrounds.</p>
          <button 
            onClick={() => navigate({ to: "/hub" })}
            className="mt-2 px-4 py-2 bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Browse Model Hub
          </button>
        </div>
      )}
    </div>
  );
}
