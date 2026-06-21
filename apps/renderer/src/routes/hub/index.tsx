import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { 
  Search, 
  Filter, 
  Check, 
  ArrowUpDown,
  Download, 
  Star,
  BookOpen, 
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { ModelEntry, HardwareProfile, DownloadJob } from "@localmind/shared-types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/")({
  component: ModelHub
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

function ModelHub() {
  const [models, setModels] = useState<any[]>([]);
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showOnlyCompatible, setShowOnlyCompatible] = useState(false);
  const [sortBy, setSortBy] = useState<string>("popularity");
  const navigate = useNavigate();

  const loadData = async () => {
    const registry = await electronAPI.send("models:getRegistry");
    const hwProfile = await electronAPI.send("hardware:getProfile");
    setHardware(hwProfile);
    setModels(registry || []);
  };

  useEffect(() => {
    loadData();

    // Listen to completed/progress events to update installed status
    const unsubProgress = electronAPI.onDownloadProgress(() => {
      loadData();
    });

    const unsubCompleted = electronAPI.onDownloadCompleted((job) => {
      toast.success(`Download complete: ${job.variantId.split("-").pop() || "Model"} is ready!`);
      loadData();
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  const handleDownload = async (modelId: string, variantId: string) => {
    try {
      const job = await electronAPI.send("downloads:enqueue", { modelId, variantId });
      if (job) {
        toast.info("Added to download queue. Check progress in Downloads tab.");
        loadData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to enqueue download");
    }
  };

  // Category filter lists
  const categories = [
    { value: "all", label: "All Categories" },
    { value: "chat", label: "Chat LLMs" },
    { value: "code", label: "Coding Assistants" },
    { value: "image-gen", label: "Image Gen" },
    { value: "audio-gen", label: "Audio Gen" },
    { value: "video-gen", label: "Video Gen" },
    { value: "tts", label: "Text-to-Speech" },
    { value: "stt", label: "Speech-to-Text" }
  ];

  // Filtering & Sorting logic
  const filteredModels = models
    .filter((model: ModelEntry & { installed: boolean }) => {
      const matchSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          model.author.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = activeCategory === "all" || model.category === activeCategory;
      
      const matchCompatibility = !showOnlyCompatible || (hardware && hardware.computeScore >= model.minComputeScore);

      return matchSearch && matchCategory && matchCompatibility;
    })
    .sort((a, b) => {
      if (sortBy === "popularity") return b.downloads - a.downloads;
      if (sortBy === "likes") return b.likes - a.likes;
      if (sortBy === "size") return a.variants[0]?.sizeGB - b.variants[0]?.sizeGB;
      return a.name.localeCompare(b.name);
    });

  // Get compatibility details
  const getCompBadge = (score: number) => {
    if (!hardware) return { label: "N/A", color: "text-text-muted bg-bg-subtle border-border" };
    if (hardware.computeScore >= score) {
      return { label: "Runs great", color: "text-success bg-success/10 border-success/30" };
    }
    if (hardware.computeScore >= score - 15) {
      return { label: "May be slow", color: "text-warning bg-warning/10 border-warning/30" };
    }
    return { label: "Insufficient specs", color: "text-danger bg-danger/10 border-danger/30" };
  };

  const getCompIcon = (score: number) => {
    if (!hardware) return <Info className="w-3.5 h-3.5" />;
    if (hardware.computeScore >= score) {
      return <CheckCircle className="w-3.5 h-3.5 text-success" />;
    }
    if (hardware.computeScore >= score - 15) {
      return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
    }
    return <XCircle className="w-3.5 h-3.5 text-danger" />;
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden relative">
      
      {/* --- LEFT FILTERS COLUMN --- */}
      <aside className="w-64 border-r border-border bg-bg-surface/30 p-6 flex flex-col gap-6 select-none shrink-0 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Search Catalog</label>
          <div className="relative">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 pl-9 pr-4 text-xs text-text-primary placeholder-text-muted outline-none transition"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Categories</label>
          <div className="flex flex-col gap-1">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`text-left px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition ${
                  activeCategory === cat.value
                    ? "bg-accent/15 border-l-2 border-accent text-text-primary font-bold shadow-inner"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Parameters</label>
          <label className="flex items-center gap-2.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyCompatible}
              onChange={(e) => setShowOnlyCompatible(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent bg-bg-base"
            />
            <span>Compatible with my hardware</span>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Sort registry</label>
          <div className="relative">
            <ArrowUpDown className="absolute top-2.5 left-3 w-4 h-4 text-text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 pl-9 pr-4 text-xs text-text-primary outline-none cursor-pointer transition"
            >
              <option value="popularity">HF Downloads</option>
              <option value="likes">Registry Likes</option>
              <option value="size">Smallest Disk Size</option>
              <option value="name">Model Name</option>
            </select>
          </div>
        </div>
      </aside>

      {/* --- CENTER MODELS GRID --- */}
      <section className="flex-1 p-8 overflow-y-auto flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Discover Local Models</h2>
          <p className="text-xs text-text-secondary mt-1">
            Select and install curated models optimized for offline compute environments. &nbsp;
            <span className="font-mono text-accent font-bold">{filteredModels.length}</span>
            <span className="text-text-muted"> of {models.length} models</span>
            {showOnlyCompatible && <span className="ml-2 px-1.5 py-0.5 bg-success/10 border border-success/20 text-success text-[9px] rounded font-mono uppercase">Hardware filtered</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredModels.map((model) => {
            const badge = getCompBadge(model.minComputeScore);
            return (
              <div 
                key={model.id}
                onClick={() => {
                  setSelectedModel(model);
                  const reqVar = model.variants.find((v: any) => v.recommended) || model.variants[0];
                  setSelectedVariantId(reqVar.id);
                }}
                className={`glass-panel rounded-xl p-5 flex flex-col justify-between hover:border-border-bright transition duration-200 cursor-pointer group ${
                  selectedModel?.id === model.id ? "ring-2 ring-accent/65" : ""
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="px-2 py-0.5 rounded bg-bg-subtle text-[10px] font-mono text-text-secondary font-semibold uppercase">
                      {model.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-text-primary mt-4 group-hover:text-accent transition truncate">
                    {model.name}
                  </h3>
                  <span className="text-[10px] text-text-muted font-mono block">by {model.author}</span>
                  <p className="text-[11px] text-text-secondary mt-2 leading-relaxed line-clamp-2">{model.description}</p>
                </div>

                <div className="mt-6 pt-3.5 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-text-muted/20" />
                      {model.likes >= 1000 ? `${(model.likes / 1000).toFixed(1)}k` : model.likes}
                    </span>
                    <span>{model.variants[0]?.sizeGB} GB</span>
                  </div>

                  {model.installed ? (
                    <span className="flex items-center gap-1 text-xs text-success font-bold font-mono">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </span>
                  ) : model.downloadStatus === "downloading" ? (
                    <div className="flex items-center gap-1.5 text-xs text-accent font-mono animate-pulse">
                      <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span>Downloading</span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted hover:text-text-primary font-bold font-mono flex items-center gap-1 transition">
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredModels.length === 0 && (
          <div className="glass-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
            <Filter className="w-12 h-12 text-text-muted" />
            <h3 className="font-bold text-sm text-text-primary">No models match filters</h3>
            <p className="text-xs text-text-secondary max-w-sm">Try clearing search inputs or toggle the compatible-only hardware checker.</p>
          </div>
        )}
      </section>

      {/* --- RIGHT DETAILS DRAWER --- */}
      <AnimatePresence>
        {selectedModel && (
          <motion.aside
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="absolute right-0 top-0 bottom-0 h-full w-96 border-l border-border bg-bg-surface/95 backdrop-blur-md p-6 flex flex-col justify-between overflow-y-auto z-40 select-none shadow-2xl"
          >
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-border/50">
                <div>
                  <span className="text-[10px] font-bold font-mono text-accent uppercase tracking-wider">{selectedModel.category} Model</span>
                  <h3 className="font-bold text-base text-text-primary mt-1">{selectedModel.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedModel(null)}
                  className="w-6 h-6 border border-border rounded-full hover:border-border-bright text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer transition"
                >
                  &times;
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-5">
                <div className="text-xs text-text-secondary leading-relaxed">
                  <p>{selectedModel.longDescription || selectedModel.description}</p>
                </div>

                {/* Variant selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider">Select Quantization / Variant</label>
                  <div className="flex flex-col gap-2">
                    {selectedModel.variants.map((variant: any) => (
                      <label 
                        key={variant.id}
                        className={`border rounded-lg p-3 flex flex-col gap-1 cursor-pointer transition select-none ${
                          selectedVariantId === variant.id
                            ? "bg-accent/10 border-accent/60"
                            : "bg-bg-base/40 border-border hover:border-border-bright"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-text-primary">{variant.label}</span>
                          <input
                            type="radio"
                            name="variant"
                            value={variant.id}
                            checked={selectedVariantId === variant.id}
                            onChange={() => setSelectedVariantId(variant.id)}
                            className="text-accent focus:ring-accent"
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-text-secondary font-mono mt-1">
                          <span>File size: {variant.sizeGB} GB</span>
                          <span>Min VRAM: {variant.minVramGB} GB</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Compatibility report */}
                <div className="glass-panel rounded-lg p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
                    <span className="text-[10px] font-bold font-mono text-text-primary uppercase tracking-wider">Compatibility Report</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">RAM Architecture</span>
                      <span className="text-text-primary font-mono font-bold flex items-center gap-1.5">
                        {hardware && hardware.ram.totalGB >= selectedModel.minRequirements.ramGB ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-warning" />
                        )}
                        {hardware?.ram.totalGB}GB / Need {selectedModel.minRequirements.ramGB}GB
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">VRAM Requirements</span>
                      <span className="text-text-primary font-mono font-bold flex items-center gap-1.5">
                        {getCompIcon(selectedModel.minComputeScore)}
                        Need {selectedModel.minRequirements.vramGB}GB VRAM
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Disk Storage</span>
                      <span className="text-text-primary font-mono font-bold flex items-center gap-1.5">
                        {hardware && hardware.disk.freeGB >= selectedModel.minRequirements.diskGB ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-danger" />
                        )}
                        {hardware?.disk.freeGB}GB Free
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tags and Metadata */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedModel.tags.map((tag: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-bg-subtle text-[9px] font-mono text-text-secondary">
                      #{tag}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded-full bg-bg-subtle text-[9px] font-mono text-text-secondary uppercase">
                    License: {selectedModel.license}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-border/50 flex flex-col gap-2 mt-6">
              {selectedModel.installed ? (
                <button
                  onClick={() => navigate({ to: getPlaygroundPath(selectedModel.category) })}
                  className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open in Playground</span>
                </button>
              ) : selectedModel.downloadStatus === "downloading" ? (
                <button
                  onClick={() => navigate({ to: "/downloads" })}
                  className="w-full py-2.5 rounded-lg bg-bg-subtle border border-border text-text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <div className="w-3.5 h-3.5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                  <span>Check Download Progress</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDownload(selectedModel.id, selectedVariantId)}
                  className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download selected variant</span>
                </button>
              )}
              
              <a 
                href={`https://huggingface.co/${selectedModel.hfRepoId}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 rounded-lg border border-border hover:border-border-bright text-text-secondary hover:text-text-primary text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Hugging Face Repository</span>
              </a>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  );
}
