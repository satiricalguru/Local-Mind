import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Video, 
  Sparkles, 
  Sliders,
  AlertTriangle,
  Film,
  Trash2,
  Play,
  Clock
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/video")({
  component: VideoPlayground
});

function VideoPlayground() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [duration, setDuration] = useState(4);
  const [fps, setFps] = useState(16);
  const [motionStrength, setMotionStrength] = useState(5);
  const [generations, setGenerations] = useState<any[]>([]);
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");

  const loadGenerations = async () => {
    const data = await electronAPI.send("generations:list", { category: "video-gen" });
    setGenerations(data || []);
  };

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const videoOnly = (data || []).filter((m: any) => m.category === "video-gen");
    setInstalledModels(videoOnly);
    if (videoOnly.length > 0) {
      setSelectedModelId(videoOnly[0].id);
    }
  };

  useEffect(() => {
    loadGenerations();
    loadModels();
  }, []);

  const handleDeleteGeneration = async (id: string) => {
    await electronAPI.send("generations:delete", { id });
    toast.info("Video generation deleted");
    loadGenerations();
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    if (!selectedModelId) {
      toast.error("Please download a Video Generation model from the Hub first.");
      return;
    }

    setIsGenerating(true);
    toast.warning(`Spawning local render pipeline... estimated ${duration * 2}min on M2 Pro.`);

    try {
      const res = await electronAPI.send("inference:generateVideo", {
        prompt,
        modelId: selectedModelId,
        params: { duration, fps, motionStrength }
      });
      if (res) {
        toast.success("Video clip rendered successfully!");
        setPrompt("");
        loadGenerations();
      }
    } catch (e) {
      toast.error("Video generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* --- LEFT SIDE SETTINGS --- */}
      <aside className="w-72 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-1.5 border-b border-border/40 pb-4">
            <Sliders className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">Video parameters</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Length (Seconds)</span>
                <span className="text-text-primary font-bold">{duration}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Frames Per Second (FPS)</label>
              <select
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none transition"
              >
                <option value="8">8 FPS (Fast Draft)</option>
                <option value="16">16 FPS (Smooth)</option>
                <option value="24">24 FPS (Cinematic)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Motion Strength</span>
                <span className="text-text-primary font-bold">{motionStrength}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={motionStrength}
                onChange={(e) => setMotionStrength(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50 bg-bg-base/30">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider block mb-1">Active Model</label>
          <div className="relative">
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none cursor-pointer transition focus:border-border-bright"
            >
              {installedModels.length > 0 ? (
                installedModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))
              ) : (
                <option value="">No Video model installed</option>
              )}
            </select>
          </div>
        </div>
      </aside>

      {/* --- RIGHT PREVIEW PANEL --- */}
      <section className="flex-1 flex flex-col justify-between min-w-0 bg-bg-base relative">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">

          {/* Computation notice */}
          <div className="glass-panel border-warning/20 bg-warning/5 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Local text-to-video (CogVideoX / AnimateDiff) requires heavy GPU. ~{duration * 2}min render on M2 Pro for a {duration}s clip at {fps}fps.
            </p>
          </div>

          {installedModels.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg select-none">
              <span>No installed Video Gen models. Go to Hub to download CogVideoX.</span>
            </div>
          )}

          {generations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Generated Clips</h3>
              <div className="flex flex-col gap-3">
                {generations.map((g) => (
                  <div key={g.id} className="glass-panel border-border/60 hover:border-border-bright rounded-xl p-4 flex items-center justify-between gap-4 transition duration-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-accent/15 border border-accent/20 text-accent">
                        <Film className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text-primary line-clamp-1">"{g.prompt}"</h4>
                        <p className="text-[9px] text-text-muted font-mono mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {g.durationMs ? (g.durationMs / 1000).toFixed(1) : "–"}s • Seed: {g.seed ?? "–"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toast.info("Video preview not available in browser simulation mode")}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
                        title="Preview clip"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGeneration(g.id)}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 cursor-pointer transition"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center mt-4">
              <Film className="w-12 h-12 text-text-muted" />
              <div>
                <h3 className="font-bold text-sm text-text-primary">Text-to-Video Generator</h3>
                <p className="text-xs text-text-secondary max-w-sm mt-1">
                  Enter a text motion prompt on the input box below to begin local rendering tasks.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Input box */}
        <div className="p-6 border-t border-border/50 bg-bg-surface/50 backdrop-blur-md flex flex-col gap-2 shrink-0">
          <div className="flex gap-4">
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
              placeholder="Describe motion dynamics (e.g. 'A slow panning shot of a glowing mechanical dragon in flight over virtual mountains')..."
              className="flex-1 bg-bg-base/70 border border-border focus:border-border-bright rounded-xl py-3 px-4 text-xs text-text-primary placeholder-text-muted outline-none resize-none transition"
              rows={2}
            />
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="px-6 bg-accent hover:bg-accent-dim disabled:bg-bg-subtle text-text-primary disabled:text-text-muted rounded-xl flex flex-col items-center justify-center gap-1 transition shrink-0 cursor-pointer"
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-text-primary" />
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
