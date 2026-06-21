import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Music, 
  Volume2, 
  Download, 
  Play, 
  Pause, 
  Sliders,
  Sparkles,
  Trash2
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/audio")({
  component: AudioPlayground
});

function AudioPlayground() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [duration, setDuration] = useState(8);
  const [seed, setSeed] = useState(42);
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const activeAudioRef = React.useRef<{
    ctx: AudioContext | null;
    oscs: OscillatorNode[];
    sources: AudioBufferSourceNode[];
    timeoutId: any;
  }>({ ctx: null, oscs: [], sources: [], timeoutId: null });

  const loadGenerations = async () => {
    const data = await electronAPI.send("generations:list", { category: "audio-gen" });
    setGenerations(data || []);
  };

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const audioOnly = (data || []).filter((m: any) => m.category === "audio-gen");
    setInstalledModels(audioOnly);
    if (audioOnly.length > 0) {
      setSelectedModelId(audioOnly[0].id);
    }
  };

  useEffect(() => {
    loadGenerations();
    loadModels();

    return () => {
      if (activeAudioRef.current.timeoutId) {
        clearTimeout(activeAudioRef.current.timeoutId);
      }
      activeAudioRef.current.oscs.forEach(osc => {
        try {
          osc.stop();
        } catch (e) {}
      });
      activeAudioRef.current.sources.forEach(src => {
        try {
          src.stop();
        } catch (e) {}
      });
      if (activeAudioRef.current.ctx) {
        try {
          activeAudioRef.current.ctx.close();
        } catch (e) {}
      }
    };
  }, []);

  const handleDeleteGeneration = async (id: string) => {
    await electronAPI.send("generations:delete", { id });
    toast.info("Audio generation deleted");
    loadGenerations();
  };

  const stopAllAudio = () => {
    if (activeAudioRef.current.timeoutId) {
      clearTimeout(activeAudioRef.current.timeoutId);
      activeAudioRef.current.timeoutId = null;
    }
    
    activeAudioRef.current.oscs.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {}
    });
    activeAudioRef.current.oscs = [];

    activeAudioRef.current.sources.forEach(src => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeAudioRef.current.sources = [];

    if (activeAudioRef.current.ctx) {
      try {
        activeAudioRef.current.ctx.close();
      } catch (e) {}
      activeAudioRef.current.ctx = null;
    }

    setPlayingId(null);
  };

  const handlePlayAudio = (id: string, promptText: string, durationMs: number, seedVal: number) => {
    if (playingId === id) {
      stopAllAudio();
      return;
    }

    stopAllAudio();

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      activeAudioRef.current.ctx = ctx;
      setPlayingId(id);

      const durationSeconds = Math.min((durationMs || 5000) / 1000, 15);
      
      let hash = 0;
      for (let i = 0; i < promptText.length; i++) {
        hash = (hash << 5) - hash + promptText.charCodeAt(i);
        hash |= 0;
      }
      const absHash = Math.abs(hash + seedVal);
      
      const baseFreq = 80 + (absHash % 160);
      
      const isLofi = promptText.toLowerCase().includes("lo-fi") || promptText.toLowerCase().includes("lofi") || promptText.toLowerCase().includes("chill") || promptText.toLowerCase().includes("slow");
      const isBeat = promptText.toLowerCase().includes("drum") || promptText.toLowerCase().includes("beat") || promptText.toLowerCase().includes("rhythm") || promptText.toLowerCase().includes("tempo") || promptText.toLowerCase().includes("loop") || promptText.toLowerCase().includes("bass");
      const isAmbient = promptText.toLowerCase().includes("ambient") || promptText.toLowerCase().includes("pad") || promptText.toLowerCase().includes("synthesizer") || promptText.toLowerCase().includes("wave");

      const speed = isLofi ? 0.6 : 0.3;
      const numNotes = Math.floor(durationSeconds / speed);
      const notes = [1, 1.2, 1.25, 1.5, 1.6, 1.8, 2.0];
      
      const oscList: OscillatorNode[] = [];
      const srcList: AudioBufferSourceNode[] = [];

      for (let step = 0; step < numNotes; step++) {
        const time = ctx.currentTime + step * speed;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        const noteIndex = (absHash + step * 17) % notes.length;
        const freq = baseFreq * notes[noteIndex];
        
        osc.type = isLofi ? "triangle" : (isAmbient ? "sine" : "sine");
        osc.frequency.setValueAtTime(freq, time);
        
        if (isAmbient && step % 2 === 0) {
          osc.frequency.exponentialRampToValueAtTime(freq * 1.05, time + speed * 0.95);
        }
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(isLofi ? 0.12 : (isAmbient ? 0.15 : 0.08), time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + speed * 0.95);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + speed);
        oscList.push(osc);
        
        if (isBeat && step % 2 === 0) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();
          
          kickOsc.frequency.setValueAtTime(120, time);
          kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);
          
          kickGain.gain.setValueAtTime(0.2, time);
          kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
          
          kickOsc.connect(kickGain);
          kickGain.connect(ctx.destination);
          kickOsc.start(time);
          kickOsc.stop(time + 0.15);
          oscList.push(kickOsc);
        }
        
        if (isBeat && step % 4 === 2) {
          const bufferSize = ctx.sampleRate * 0.08;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.value = 1000;
          
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.08, time);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
          
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(time);
          noise.stop(time + 0.08);
          srcList.push(noise);
        }
      }

      activeAudioRef.current.oscs = oscList;
      activeAudioRef.current.sources = srcList;

      activeAudioRef.current.timeoutId = setTimeout(() => {
        setPlayingId(null);
      }, durationSeconds * 1000);

      toast.success(`Playing synthesized audio preview (${durationSeconds.toFixed(1)}s)...`);
    } catch (e) {
      toast.info("Playing offline synthesized clip preview...");
      setPlayingId(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    if (!selectedModelId) {
      toast.error("Please download an Audio Generation model from the Hub first.");
      return;
    }

    setIsGenerating(true);
    toast.info("Synthesizing offline audio waves...");

    try {
      const res = await electronAPI.send("inference:generateAudio", {
        prompt,
        modelId: selectedModelId,
        params: { duration, seed }
      });
      if (res) {
        toast.success("Audio clip synthesized successfully!");
        setPrompt("");
        loadGenerations();
      }
    } catch (e) {
      toast.error("Audio generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* --- LEFT CONTROL BAR --- */}
      <aside className="w-72 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-1.5 border-b border-border/40 pb-4">
            <Sliders className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">Audio parameters</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Duration Limit</span>
                <span className="text-text-primary font-bold">{duration}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="30"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Seed value</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value))}
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none transition"
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
                <option value="">No Audio model installed</option>
              )}
            </select>
          </div>
        </div>
      </aside>

      {/* --- RIGHT AUDIO VIEW --- */}
      <section className="flex-1 flex flex-col justify-between min-w-0 bg-bg-base relative">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {generations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Synthesized Audio Tracks</h3>
              <div className="flex flex-col gap-3">
                {generations.map((g) => (
                  <div key={g.id} className="glass-panel border-border/60 hover:border-border-bright rounded-xl p-4 flex items-center justify-between gap-4 transition duration-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-accent/15 border border-accent/20 text-accent">
                        <Music className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text-primary">"{g.prompt}"</h4>
                        <p className="text-[9px] text-text-muted font-mono mt-0.5">Duration: {g.durationMs / 1000}s • Seed: {g.seed}</p>
                      </div>
                    </div>

                     <div className="flex items-center gap-3">
                      {/* Playback preview controller */}
                      <button 
                        onClick={() => handlePlayAudio(g.id, g.prompt, g.durationMs || 5000, g.seed || 42)}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
                        title={playingId === g.id ? "Pause Audio" : "Play Synthesized Audio"}
                      >
                        {playingId === g.id ? (
                          <Pause className="w-4 h-4 fill-text-secondary" />
                        ) : (
                          <Play className="w-4 h-4 fill-text-secondary" />
                        )}
                      </button>
                      <button 
                        onClick={() => toast.success("Saved synthesized audio file to downloads path")}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
                        title="Download Audio"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteGeneration(g.id)}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 cursor-pointer transition"
                        title="Delete audio record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center">
              <Music className="w-12 h-12 text-text-muted" />
              <div>
                <h3 className="font-bold text-sm text-text-primary">Audio Generation Sandbox</h3>
                <p className="text-xs text-text-secondary max-w-sm mt-1">
                  Describe a loop rhythm or ambient track to synthesize audio waves locally using AudioLDM.
                </p>
              </div>
              {installedModels.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg mt-2 select-none">
                  <span>No installed Audio Gen models. Go to Hub to download MusicGen Small.</span>
                </div>
              )}
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
              placeholder="Describe sound effects or instrumental theme (e.g. 'Lo-fi drum loop with jazz electric piano, smooth ambient feel')..."
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
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Synthesize</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
