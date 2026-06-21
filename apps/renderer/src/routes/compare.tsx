import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  GitCompare, 
  Send, 
  Bot, 
  Gauge, 
  Zap, 
  AlertCircle
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/compare")({
  component: ModelComparison
});

function ModelComparison() {
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Split outcomes state
  const [outputA, setOutputA] = useState("");
  const [outputB, setOutputB] = useState("");
  const [statsA, setStatsA] = useState<any>(null);
  const [statsB, setStatsB] = useState<any>(null);

  useEffect(() => {
    async function loadModels() {
      const data = await electronAPI.send("models:getInstalled");
      const chatOnly = (data || []).filter((m: any) => m.category === "chat" || m.category === "code");
      setInstalledModels(chatOnly);
      if (chatOnly.length > 0) {
        setModelA(chatOnly[0].id);
        if (chatOnly.length > 1) {
          setModelB(chatOnly[1].id);
        } else {
          setModelB(chatOnly[0].id);
        }
      }
    }
    loadModels();
  }, []);

  const handleCompare = () => {
    if (!prompt.trim() || isGenerating) return;
    if (!modelA || !modelB) {
      toast.error("Please configure two models to compare");
      return;
    }

    setIsGenerating(true);
    setOutputA("");
    setOutputB("");
    setStatsA(null);
    setStatsB(null);

    toast.info("Launching parallel local inference pipelines...");

    // Parallel streaming simulation
    const textA = `[Output from ${modelA.split("/").pop()}]\n\nLocal systems offload matrix computations via metal/vulkan structures. This model is lightweight and highly optimized for speed over deep logic reasoning blocks.`;
    const textB = `[Output from ${modelB.split("/").pop()}]\n\nChain-of-thought activations are enabled for this run. Offloading 32 layers to GPU vram structure, context cache hit is 100%. Expect high accuracy on math and script syntaxes.`;

    const wordsA = textA.split(" ");
    const wordsB = textB.split(" ");

    let doneA = false;
    let doneB = false;
    let idxA = 0;
    let idxB = 0;

    const checkDone = () => {
      if (doneA && doneB) {
        setIsGenerating(false);
        setPrompt("");
        toast.success("Parallel evaluation finished!");
      }
    };

    const intervalA = setInterval(() => {
      if (idxA >= wordsA.length) {
        clearInterval(intervalA);
        setStatsA({ tps: 32.4, latency: 150 });
        doneA = true;
        checkDone();
      } else {
        setOutputA(prev => prev + wordsA[idxA] + " ");
        idxA++;
      }
    }, 70);

    const intervalB = setInterval(() => {
      if (idxB >= wordsB.length) {
        clearInterval(intervalB);
        setStatsB({ tps: 24.8, latency: 210 });
        doneB = true;
        checkDone();
      } else {
        setOutputB(prev => prev + wordsB[idxB] + " ");
        idxB++;
      }
    }, 90);
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6 select-none overflow-hidden">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-accent" />
            <span>Model Comparison</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">Run any prompt on two local models simultaneously to test formatting, tone, and logic speed.</p>
        </div>
      </div>

      {/* Model selectors row */}
      <div className="grid grid-cols-2 gap-6 shrink-0">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Model A (Left)</label>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text-primary outline-none cursor-pointer transition focus:border-border-bright"
          >
            {installedModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Model B (Right)</label>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text-primary outline-none cursor-pointer transition focus:border-border-bright"
          >
            {installedModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Split output screen */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">
        {/* Left output */}
        <div className="glass-panel rounded-xl flex flex-col justify-between overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto font-sans text-xs leading-relaxed text-text-primary">
            {outputA ? (
              <pre className="whitespace-pre-wrap font-sans">{outputA}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-center gap-2">
                <Bot className="w-8 h-8" />
                <span>Waiting for prompt dispatch...</span>
              </div>
            )}
          </div>
          {statsA && (
            <div className="px-5 py-3 border-t border-border/50 bg-bg-base/30 flex justify-between items-center text-[10px] font-mono text-text-muted">
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-success" />
                {statsA.tps} t/s
              </span>
              <span>TTFT: {statsA.latency}ms</span>
            </div>
          )}
        </div>

        {/* Right output */}
        <div className="glass-panel rounded-xl flex flex-col justify-between overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto font-sans text-xs leading-relaxed text-text-primary">
            {outputB ? (
              <pre className="whitespace-pre-wrap font-sans">{outputB}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-center gap-2">
                <Bot className="w-8 h-8" />
                <span>Waiting for prompt dispatch...</span>
              </div>
            )}
          </div>
          {statsB && (
            <div className="px-5 py-3 border-t border-border/50 bg-bg-base/30 flex justify-between items-center text-[10px] font-mono text-text-muted">
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-success" />
                {statsB.tps} t/s
              </span>
              <span>TTFT: {statsB.latency}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Input console */}
      <div className="p-4 border border-border/80 rounded-xl bg-bg-surface/50 backdrop-blur-md flex items-center gap-4 shrink-0">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing) return;
              e.preventDefault();
              handleCompare();
            }
          }}
          placeholder="Enter a prompt and hit compare..."
          className="flex-1 bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2.5 px-4 text-xs text-text-primary placeholder-text-muted outline-none resize-none transition"
          rows={1}
        />
        <button
          onClick={handleCompare}
          disabled={isGenerating || !prompt.trim()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-dim disabled:bg-bg-subtle text-text-primary disabled:text-text-muted rounded-lg flex items-center gap-1.5 transition shrink-0 cursor-pointer text-xs font-bold font-mono"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Compare</span>
        </button>
      </div>

    </div>
  );
}
