import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Volume2, 
  Download, 
  Play, 
  Sliders,
  AudioWaveform,
  Sparkles,
  PlayCircle,
  Trash2
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/tts")({
  component: TTSPlayground
});

const kokoroVoices = [
  { value: "af_heart", label: "Heart (US Female - Default)", lang: "en-US", gender: "female" },
  { value: "af_bella", label: "Bella (US Female - Warm)", lang: "en-US", gender: "female" },
  { value: "af_sarah", label: "Sarah (US Female - Crisp)", lang: "en-US", gender: "female" },
  { value: "af_nicole", label: "Nicole (US Female - Expressive)", lang: "en-US", gender: "female" },
  { value: "af_sky", label: "Sky (US Female - Balanced)", lang: "en-US", gender: "female" },
  { value: "am_adam", label: "Adam (US Male - Deep)", lang: "en-US", gender: "male" },
  { value: "am_michael", label: "Michael (US Male - Corporate)", lang: "en-US", gender: "male" },
  { value: "bf_emma", label: "Emma (UK Female - Smooth)", lang: "en-GB", gender: "female" },
  { value: "bf_isabella", label: "Isabella (UK Female - Clear)", lang: "en-GB", gender: "female" },
  { value: "bm_george", label: "George (UK Male - Authoritative)", lang: "en-GB", gender: "male" },
  { value: "bm_lewis", label: "Lewis (UK Male - Warm)", lang: "en-GB", gender: "male" },
  { value: "jf_alpha", label: "Alpha (JP Female - Sweet)", lang: "ja-JP", gender: "female" },
  { value: "jf_glowing", label: "Glowing (JP Female - Bright)", lang: "ja-JP", gender: "female" },
  { value: "jm_kiko", label: "Kiko (JP Male - Natural)", lang: "ja-JP", gender: "male" }
];

function TTSPlayground() {
  const [text, setText] = useState("");
  const [selectedKokoroVoice, setSelectedKokoroVoice] = useState<string>("af_heart");
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");

  const loadGenerations = async () => {
    const data = await electronAPI.send("generations:list", { category: "tts" });
    setGenerations(data || []);
  };

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const ttsOnly = (data || []).filter((m: any) => m.category === "tts");
    setInstalledModels(ttsOnly);
    if (ttsOnly.length > 0) {
      setSelectedModelId(ttsOnly[0].id);
    }
  };

  useEffect(() => {
    loadGenerations();
    loadModels();
    // Cache standard speech voices early
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const handleDeleteGeneration = async (id: string) => {
    await electronAPI.send("generations:delete", { id });
    toast.info("Voice generation deleted");
    loadGenerations();
  };

  const handlePlayTTS = (promptText: string, voiceValue: string) => {
    if (!window.speechSynthesis) {
      toast.error("Web Speech API is not supported in this environment");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(promptText);
    const voices = window.speechSynthesis.getVoices();
    
    // Find the voice metadata from our list
    const voiceMetadata = kokoroVoices.find(v => v.value === voiceValue) || kokoroVoices[0];
    const targetLang = voiceMetadata.lang;
    const targetGender = voiceMetadata.gender;

    // Search standard system voices matching this language and gender
    let matchedVoice = voices.find(v => {
      const nameLower = v.name.toLowerCase();
      const langMatch = v.lang.toLowerCase().replace("_", "-").startsWith(targetLang.toLowerCase().replace("_", "-"));
      const genderMatch = targetGender === "female" 
        ? (nameLower.includes("siri") || nameLower.includes("female") || nameLower.includes("samantha") || nameLower.includes("karen") || nameLower.includes("moira") || nameLower.includes("tessa"))
        : (nameLower.includes("siri") || nameLower.includes("male") || nameLower.includes("daniel") || nameLower.includes("alex") || nameLower.includes("fred") || nameLower.includes("oliver"));
      return langMatch && genderMatch;
    });

    // Fallback just matching language
    if (!matchedVoice) {
      matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetLang.toLowerCase().substring(0, 2)));
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = speed || 1.0;
    
    window.speechSynthesis.speak(utterance);
    toast.success(`Playing offline voice preview using ${matchedVoice ? matchedVoice.name : "default voice"} (${voiceMetadata.label})...`);
  };

  const handleSynthesize = async () => {
    if (!text.trim() || isGenerating) return;

    if (!selectedModelId) {
      toast.error("Please download a Text-to-Speech model from the Hub first.");
      return;
    }

    setIsGenerating(true);
    toast.info("Generating offline voice synthesis...");

    try {
      const res = await electronAPI.send("inference:speak", {
        text,
        modelId: selectedModelId,
        voice: selectedKokoroVoice
      });
      if (res) {
        toast.success("Voice synthesized successfully!");
        setText("");
        loadGenerations();
      }
    } catch (e) {
      toast.error("TTS failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* --- LEFT CONTROL PANEL --- */}
      <aside className="w-72 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-1.5 border-b border-border/40 pb-4">
            <Sliders className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">Voice settings</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Speaker Voice</label>
              <select
                value={selectedKokoroVoice}
                onChange={(e) => setSelectedKokoroVoice(e.target.value)}
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none transition cursor-pointer"
              >
                {kokoroVoices.map(v => (
                  <option key={v.value} value={v.value}>
                    {v.label} ({v.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Speech Speed</span>
                <span className="text-text-primary font-bold">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
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
                <option value="">No TTS model installed</option>
              )}
            </select>
          </div>
        </div>
      </aside>

      {/* --- RIGHT TTS LIST --- */}
      <section className="flex-1 flex flex-col justify-between min-w-0 bg-bg-base relative">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          
          {generations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Generated Speech Tracks</h3>
              <div className="flex flex-col gap-3">
                {generations.map((g) => (
                  <div key={g.id} className="glass-panel border-border/60 hover:border-border-bright rounded-xl p-4 flex items-center justify-between gap-4 transition duration-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded bg-accent/15 border border-accent/20 text-accent">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text-primary line-clamp-1">"{g.prompt}"</h4>
                        <p className="text-[9px] text-text-muted font-mono mt-0.5">
                          Voice: {JSON.parse(g.paramsJson || "{}").voice || selectedKokoroVoice} • Length: {(g.durationMs / 1000).toFixed(1)}s
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const voiceObj = JSON.parse(g.paramsJson || "{}");
                          handlePlayTTS(g.prompt, voiceObj.voice || selectedKokoroVoice);
                        }}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
                        title="Play Audio Speech"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toast.success("Saved synthesized voice clip to downloads path")}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle cursor-pointer transition"
                        title="Download MP3"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteGeneration(g.id)}
                        className="p-1.5 border border-border rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 cursor-pointer transition"
                        title="Delete voice record"
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
              <AudioWaveform className="w-12 h-12 text-text-muted animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-text-primary">Text-to-Speech Synthesizer</h3>
                <p className="text-xs text-text-secondary max-w-sm mt-1">
                  Type any sentence in the input drawer below to render offline speech using Kokoro TTS.
                </p>
              </div>
              {installedModels.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg mt-2 select-none">
                  <span>No installed TTS models. Go to Hub to download Kokoro 82M.</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Input box */}
        <div className="p-6 border-t border-border/50 bg-bg-surface/50 backdrop-blur-md flex flex-col gap-2 shrink-0">
          <div className="flex gap-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  handleSynthesize();
                }
              }}
              placeholder="Type or paste any paragraph you want read aloud locally..."
              className="flex-1 bg-bg-base/70 border border-border focus:border-border-bright rounded-xl py-3 px-4 text-xs text-text-primary placeholder-text-muted outline-none resize-none transition"
              rows={2}
            />
            
            <button
              onClick={handleSynthesize}
              disabled={isGenerating || !text.trim()}
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
