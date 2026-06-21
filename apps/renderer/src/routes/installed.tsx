import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { 
  FolderLock, 
  Trash2, 
  Play, 
  HardDrive,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/installed")({
  component: InstalledModels
});

const getPlaygroundPath = (category: string) => {
  switch (category) {
    case "chat":
    case "code":
      return "/playground/chat";
    case "image-gen":
      return "/playground/image";
    case "audio-gen":
      return "/playground/audio";
    case "video-gen":
      return "/playground/video";
    case "tts":
      return "/playground/tts";
    case "stt":
      return "/playground/stt";
    default:
      return "/playground/chat";
  }
};

function InstalledModels() {
  const [installed, setInstalled] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadModels = async () => {
    setIsLoading(true);
    const data = await electronAPI.send("models:getInstalled");
    setInstalled(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from your disk?`)) {
      try {
        const res = await electronAPI.send("models:removeModel", { id });
        if (res.success) {
          toast.success(`${name} deleted successfully`);
          loadModels();
        }
      } catch (e) {
        toast.error("Failed to delete model file");
      }
    }
  };

  // Disk spacing calculations
  const totalSizeBytes = installed.reduce((acc, m) => acc + m.sizeBytes, 0);
  const totalSizeGB = Math.round((totalSizeBytes / (1024 * 1024 * 1024)) * 10) / 10;

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6 select-none">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-accent" />
            <span>Installed Local Models</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">Manage models currently stored on your storage path.</p>
        </div>
        
        <button 
          onClick={loadModels}
          className="p-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Storage allocation card */}
      <div className="glass-panel rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Storage Occupied</h3>
            <p className="text-xs text-text-secondary mt-0.5 font-mono">{totalSizeGB} GB used by local registry models</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <FolderOpen className="w-4 h-4" />
          <span>~/LocalMind/models</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : installed.length > 0 ? (
        <div className="flex flex-col gap-3">
          {installed.map((model) => (
            <div 
              key={model.id}
              className="glass-panel hover:border-border-bright rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition duration-200"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-bg-subtle text-[10px] font-mono text-text-secondary font-semibold uppercase">
                    {model.category}
                  </span>
                  <h3 className="font-bold text-sm text-text-primary">{model.name}</h3>
                </div>
                <p className="text-xs text-text-secondary mt-1 max-w-lg leading-relaxed">
                  Variant: <span className="font-mono text-accent text-[11px] font-bold">{model.variantId.split("-").pop()}</span> • File path: <span className="font-mono text-[10px]">{model.filePath}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => navigate({ to: getPlaygroundPath(model.category) })}
                  className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Launch</span>
                </button>

                <button
                  onClick={() => handleDelete(model.id, model.name)}
                  className="p-1.5 border border-danger/30 hover:border-danger bg-danger/5 text-danger hover:bg-danger/10 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <FolderLock className="w-12 h-12 text-text-muted" />
          <h3 className="font-bold text-sm text-text-primary">No models installed</h3>
          <p className="text-xs text-text-secondary max-w-sm">Browse the model hub catalog to install your first LLM or generative model.</p>
          <button 
            onClick={() => navigate({ to: "/hub" })}
            className="mt-2 px-4 py-2 bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Go to Model Hub
          </button>
        </div>
      )}
    </div>
  );
}
