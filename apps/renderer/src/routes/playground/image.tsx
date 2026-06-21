import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Image as ImageIcon, 
  Send, 
  Sparkles, 
  Download, 
  Share2, 
  Layers, 
  Sliders,
  Play,
  Trash2
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/image")({
  component: ImagePlayground
});

function ImagePlayground() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);

  // Generation parameters
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [batchSize, setBatchSize] = useState(1);
  const [sampler, setSampler] = useState("Euler A");

  const handleDeleteGeneration = async (id: string) => {
    await electronAPI.send("generations:delete", { id });
    toast.info("Image generation deleted");
    loadGenerations();
  };

  useEffect(() => {
    loadModels();
    loadGenerations();
  }, []);

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const imageOnly = (data || []).filter((m: any) => m.category === "image-gen");
    setInstalledModels(imageOnly);
    if (imageOnly.length > 0) {
      setSelectedModelId(imageOnly[0].id);
    }
  };

  const loadGenerations = async () => {
    const data = await electronAPI.send("generations:list", { category: "image-gen" });
    setGenerations(data || []);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!selectedModelId) {
      toast.error("Please download an image generation model first");
      return;
    }

    setIsGenerating(true);
    toast.info("Inference started. Generating local image files...");

    try {
      const res = await electronAPI.send("inference:generateImage", {
        prompt,
        modelId: selectedModelId,
        params: {
          steps,
          cfgScale,
          width,
          height,
          sampler,
          negativePrompt,
          batchSize
        }
      });

      if (res) {
        toast.success("Generation completed!");
        setPrompt("");
        loadGenerations();
      }
    } catch (e) {
      toast.error("Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* --- LEFT PARAMETERS PANEL --- */}
      <aside className="w-80 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto">
        <div className="flex flex-col gap-1.5 border-b border-border/40 pb-4">
          <div className="flex items-center gap-1.5 text-text-primary font-bold">
            <Sliders className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider">Image Settings</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Active Diffusion Model</label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 px-3 text-xs text-text-primary outline-none cursor-pointer transition"
          >
            {installedModels.length > 0 ? (
              installedModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))
            ) : (
              <option value="">No image models installed</option>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-text-secondary">Sampler Steps</span>
              <span className="text-text-primary font-bold">{steps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value))}
              className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-text-secondary">CFG Guidance Scale</span>
              <span className="text-text-primary font-bold">{cfgScale}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={cfgScale}
              onChange={(e) => setCfgScale(parseFloat(e.target.value))}
              className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Width</label>
              <select
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value))}
                className="bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-2.5 text-xs text-text-primary outline-none cursor-pointer transition"
              >
                <option value="256">256 px</option>
                <option value="512">512 px</option>
                <option value="768">768 px</option>
                <option value="1024">1024 px</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Height</label>
              <select
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value))}
                className="bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-2.5 text-xs text-text-primary outline-none cursor-pointer transition"
              >
                <option value="256">256 px</option>
                <option value="512">512 px</option>
                <option value="768">768 px</option>
                <option value="1024">1024 px</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Scheduler / Sampler</label>
            <select
              value={sampler}
              onChange={(e) => setSampler(e.target.value)}
              className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none cursor-pointer transition"
            >
              <option value="Euler A">Euler Ancestral</option>
              <option value="DPM++ 2M Karras">DPM++ 2M Karras</option>
              <option value="DDIM">DDIM</option>
              <option value="PNDM">PNDM</option>
            </select>
          </div>
        </div>
      </aside>

      {/* --- RIGHT GENERATION VIEW & HISTORY --- */}
      <section className="flex-1 flex flex-col justify-between min-w-0 bg-bg-base relative">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          
          {generations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Output Gallery</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generations.map((g) => (
                  <div key={g.id} className="glass-panel border-border/80 hover:border-border-bright rounded-xl overflow-hidden group flex flex-col">
                    {/* Generative Visual representation (mock dynamic radial gradients) */}
                    <div 
                      className="w-full aspect-square border-b border-border bg-gradient-to-tr from-accent/20 via-bg-surface to-info/20 flex items-center justify-center relative p-6 text-center select-none"
                    >
                      <Sparkles className="w-10 h-10 text-accent animate-pulse" />
                      <span className="absolute bottom-4 left-4 right-4 text-[10px] font-mono text-text-secondary line-clamp-2 bg-bg-base/80 p-1.5 border border-border rounded">
                        "{g.prompt}"
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between text-xs font-mono">
                      <span className="text-text-muted">Seed: {g.seed}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toast.success("Saved image to downloads path")}
                          className="p-1 text-text-secondary hover:text-accent cursor-pointer transition"
                          title="Save Image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteGeneration(g.id)}
                          className="p-1 text-text-secondary hover:text-danger cursor-pointer transition"
                          title="Delete image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center">
              <ImageIcon className="w-12 h-12 text-text-muted" />
              <div>
                <h3 className="font-bold text-sm text-text-primary">Image Generation Canvas</h3>
                <p className="text-xs text-text-secondary max-w-sm mt-1">
                  Type a prompt on the bottom box to generate offline local graphics using diffusion models.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Input box */}
        <div className="p-6 border-t border-border/50 bg-bg-surface/50 backdrop-blur-md flex flex-col gap-4 shrink-0">
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe the image you want to generate locally (e.g. 'A futuristic city illuminated by neon violet bioluminescent cables, premium art, 8k')..."
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-xl py-3 px-4 text-xs text-text-primary placeholder-text-muted outline-none resize-none transition"
                rows={2}
              />
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Negative prompt (things to avoid)..."
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 px-4 text-xs text-text-primary placeholder-text-muted outline-none transition"
              />
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="px-6 bg-accent hover:bg-accent-dim disabled:bg-bg-subtle text-text-primary disabled:text-text-muted rounded-xl flex flex-col items-center justify-center gap-1 transition shrink-0 cursor-pointer"
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Render</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
