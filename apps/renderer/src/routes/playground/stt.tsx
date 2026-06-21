import React, { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Mic, 
  UploadCloud, 
  Clock, 
  FileText,
  Sliders,
  Clipboard,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/stt")({
  component: STTPlayground
});

// Realistic varied mock transcription outputs
const MOCK_TRANSCRIPTS = [
  {
    text: "Good morning everyone. Today we're going to discuss the Q3 product roadmap and the key milestones we need to hit before the end of the quarter.",
    segments: [
      { start: 0.0, end: 3.2, text: "Good morning everyone." },
      { start: 3.2, end: 6.8, text: "Today we're going to discuss the Q3 product roadmap" },
      { start: 6.8, end: 10.4, text: "and the key milestones we need to hit before the end of the quarter." }
    ]
  },
  {
    text: "The quick brown fox jumps over the lazy dog. This is a sample transcription from an uploaded audio file processed by Whisper offline.",
    segments: [
      { start: 0.0, end: 2.5, text: "The quick brown fox jumps over the lazy dog." },
      { start: 2.5, end: 6.1, text: "This is a sample transcription from an uploaded audio file" },
      { start: 6.1, end: 9.3, text: "processed by Whisper offline." }
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
    text: "In this tutorial, we'll learn how to set up a local development environment. First, you'll need to install Node.js and configure your package manager.",
    segments: [
      { start: 0.0, end: 3.6, text: "In this tutorial, we'll learn how to set up a local development environment." },
      { start: 3.6, end: 7.1, text: "First, you'll need to install Node.js" },
      { start: 7.1, end: 10.8, text: "and configure your package manager." }
    ]
  },
  {
    text: "Scientists have discovered a new method for carbon capture that could significantly reduce atmospheric CO2 levels. The technique uses specialized nanomaterials to absorb and store greenhouse gases.",
    segments: [
      { start: 0.0, end: 4.2, text: "Scientists have discovered a new method for carbon capture" },
      { start: 4.2, end: 8.5, text: "that could significantly reduce atmospheric CO2 levels." },
      { start: 8.5, end: 14.1, text: "The technique uses specialized nanomaterials to absorb and store greenhouse gases." }
    ]
  }
];

function getRandomTranscript() {
  return MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function STTPlayground() {
  const [transcript, setTranscript] = useState<{ text: string; segments: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [language, setLanguage] = useState("auto");
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const recordingIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/ogg", "audio/webm", "audio/flac", "video/mp4"];
  const ACCEPTED_EXT = [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".mp4"];

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const sttOnly = (data || []).filter((m: any) => m.category === "stt");
    setInstalledModels(sttOnly);
    if (sttOnly.length > 0) {
      setSelectedModelId(sttOnly[0].id);
    }
  };

  useEffect(() => {
    loadModels();
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const validateFile = (file: File): boolean => {
    const validType = ACCEPTED_TYPES.includes(file.type) || 
      ACCEPTED_EXT.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!validType) {
      toast.error(`Unsupported format: ${file.name}. Use WAV, MP3, M4A, OGG, FLAC or WebM.`);
      return false;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File too large. Maximum supported size is 500MB.");
      return false;
    }
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return;
    setUploadedFile(file);
    setTranscript(null);
    toast.success(`Loaded: ${file.name} (${formatFileSize(file.size)})`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset so same file can be reselected
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleTranscribeFile = async () => {
    if (!uploadedFile) {
      toast.error("Please select an audio file first.");
      return;
    }
    if (!selectedModelId) {
      toast.error("Please download a Speech-to-Text model from the Hub first.");
      return;
    }

    setIsProcessing(true);
    toast.info(`Transcribing ${uploadedFile.name} with Whisper...`);

    // Simulate processing time proportional to file size (capped)
    const simulatedMs = Math.min(1500 + (uploadedFile.size / (1024 * 1024)) * 400, 6000);

    setTimeout(async () => {
      try {
        const res = await electronAPI.send("inference:transcribe", {
          audioPath: uploadedFile.name,
          modelId: selectedModelId,
          language,
          fileName: uploadedFile.name,
          fileSize: uploadedFile.size
        });
        if (res) {
          setTranscript(res);
          toast.success(`Transcription complete — ${res.segments.length} segment(s) detected.`);
        }
      } catch (e) {
        toast.error("Transcription failed");
      } finally {
        setIsProcessing(false);
      }
    }, simulatedMs);
  };

  const handleToggleRecord = () => {
    if (!selectedModelId) {
      toast.error("Please download a Speech-to-Text model from the Hub first.");
      return;
    }

    if (isRecording) {
      // Stop recording
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setIsRecording(false);
      setIsProcessing(true);
      setUploadedFile(null);
      toast.info("Transcribing recorded microphone segment...");

      setTimeout(async () => {
        try {
          const res = await electronAPI.send("inference:transcribe", {
            audioPath: "/mic/recorded_audio.wav",
            modelId: selectedModelId,
            language,
            isLiveMic: true,
            durationSec: recordingSeconds
          });
          if (res) {
            setTranscript({
              text: `[Live Mic — ${recordingSeconds}s] ${res.text}`,
              segments: res.segments
            });
            toast.success("Mic recording transcribed successfully!");
          }
        } catch (e) {
          toast.error("Transcription failed");
        } finally {
          setIsProcessing(false);
          setRecordingSeconds(0);
        }
      }, 2000);
    } else {
      // Start recording
      setIsRecording(true);
      setUploadedFile(null);
      setTranscript(null);
      setRecordingSeconds(0);
      toast.success("Microphone active. Speak now...");

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 30) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
            setIsRecording(false);
            setIsProcessing(true);
            toast.info("Max record limit reached (30s). Transcribing...");
            setTimeout(async () => {
              try {
                const res = await electronAPI.send("inference:transcribe", {
                  audioPath: "/mic/recorded_audio.wav",
                  modelId: selectedModelId,
                  language,
                  isLiveMic: true,
                  durationSec: 30
                });
                if (res) {
                  setTranscript({
                    text: `[Live Mic — 30s] ${res.text}`,
                    segments: res.segments
                  });
                  toast.success("Auto-stopped and transcribed!");
                }
              } catch (e) {
                toast.error("Transcription failed");
              } finally {
                setIsProcessing(false);
                setRecordingSeconds(0);
              }
            }, 2000);
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setTranscript(null);
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXT.join(",")}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* --- LEFT CONTROL PANEL --- */}
      <aside className="w-72 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-1.5 border-b border-border/40 pb-4">
            <Sliders className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">Whisper Settings</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Transcription Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-1.5 px-3 text-xs text-text-primary outline-none transition cursor-pointer"
              >
                <option value="auto">Auto Detect Language</option>
                <option value="en">English (US/UK)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="zh">Chinese (中文)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="pt">Portuguese (Português)</option>
                <option value="ar">Arabic (العربية)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
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
                <option value="">No STT model installed</option>
              )}
            </select>
          </div>
        </div>
      </aside>

      {/* --- RIGHT TRANSCRIBER VIEW --- */}
      <section className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 bg-bg-base">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Mic className="w-5 h-5 text-accent" />
            <span>Voice Transcription (STT)</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">Convert audio waveforms to text offline using Whisper.cpp.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload panel */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <span className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Input Source</span>
            
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isProcessing && !isRecording && fileInputRef.current?.click()}
              className={`glass-panel border-dashed border-2 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center transition cursor-pointer select-none ${
                isDragOver
                  ? "border-accent bg-accent/10"
                  : uploadedFile
                  ? "border-success/50 bg-success/5 hover:border-success"
                  : "border-border hover:border-accent hover:bg-accent/5"
              } ${isProcessing || isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {uploadedFile ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-success" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-text-primary truncate max-w-full px-2">{uploadedFile.name}</span>
                    <span className="text-[10px] text-text-muted font-mono">{formatFileSize(uploadedFile.size)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearFile(); }}
                    className="flex items-center gap-1 text-[10px] text-danger hover:text-danger/80 transition mt-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </>
              ) : (
                <>
                  <UploadCloud className={`w-8 h-8 ${isDragOver ? "text-accent animate-bounce" : "text-accent"}`} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-text-primary">
                      {isDragOver ? "Drop to load" : "Upload Audio File"}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">WAV, MP3, M4A, OGG, FLAC</span>
                    <span className="text-[10px] text-text-muted">or drag & drop here</span>
                  </div>
                </>
              )}
            </div>

            {/* Transcribe file button */}
            {uploadedFile && (
              <button
                onClick={handleTranscribeFile}
                disabled={isProcessing || isRecording}
                className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition bg-accent hover:bg-accent-dim disabled:bg-bg-subtle text-text-primary disabled:text-text-muted"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                    <span>Transcribing...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Transcribe File</span>
                  </>
                )}
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
              <div className="flex-1 h-px bg-border/60" />
              <span>OR</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            {/* Record button */}
            <button 
              onClick={handleToggleRecord}
              disabled={isProcessing}
              className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition select-none ${
                isRecording 
                  ? "bg-danger/20 border border-danger text-danger hover:bg-danger/30" 
                  : "bg-bg-surface border border-border hover:border-border-bright text-text-primary"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isRecording ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-danger animate-pulse" />
                  <span>Stop Recording ({recordingSeconds}s / 30s)</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-accent" />
                  <span>Record Live Mic</span>
                </>
              )}
            </button>

            {installedModels.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg select-none leading-normal">
                <span>No installed STT models. Go to Hub to download Whisper Base.</span>
              </div>
            )}
          </div>

          {/* Output pane */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <span className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Transcription Output</span>

            {isProcessing ? (
              <div className="glass-panel rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 h-48">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-text-secondary">
                  {uploadedFile ? `Processing ${uploadedFile.name}...` : "Transcribing audio segment..."}
                </span>
                <span className="text-[10px] text-text-muted font-mono">Whisper generating token segments...</span>
              </div>
            ) : transcript ? (
              <div className="glass-panel rounded-xl p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-text-primary">Transcription Result</span>
                    <span className="text-[10px] font-mono text-text-muted ml-1">
                      {transcript.segments.length} segment{transcript.segments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(transcript!.text);
                      toast.success("Transcript copied to clipboard");
                    }}
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary transition cursor-pointer"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>

                <div className="text-xs text-text-primary leading-relaxed bg-bg-base/40 p-4 border border-border rounded-lg">
                  {transcript.text}
                </div>

                {transcript.segments.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Segments</span>
                    <div className="flex flex-col gap-2">
                      {transcript.segments.map((seg, idx) => (
                        <div key={idx} className="flex gap-4 items-start py-1.5 border-b border-border/30 last:border-0 text-xs">
                          <span className="font-mono text-accent shrink-0 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            [{seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s]
                          </span>
                          <span className="text-text-secondary">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setTranscript(null); setUploadedFile(null); }}
                  className="text-[10px] text-text-muted hover:text-danger transition cursor-pointer self-end"
                >
                  Clear result
                </button>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 h-48">
                <FileText className="w-10 h-10 text-text-muted" />
                <p className="text-xs text-text-secondary max-w-sm">Upload an audio file or use your microphone to transcribe speech offline.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
