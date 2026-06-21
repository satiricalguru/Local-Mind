import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  Cpu, 
  Database, 
  Terminal, 
  Download, 
  HardDrive,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
  Flame,
  Zap,
  Play,
  Bookmark
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { HardwareProfile, ModelEntry, HardwareLiveStats } from "@localmind/shared-types";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/")({
  component: Dashboard
});

function Dashboard() {
  const [profile, setProfile] = useState<HardwareProfile | null>(null);
  const [stats, setStats] = useState<HardwareLiveStats | null>(null);
  const [recommended, setRecommended] = useState<ModelEntry[]>([]);
  const [activeDownloadCount, setActiveDownloadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      const hwProfile = await electronAPI.send("hardware:getProfile");
      setProfile(hwProfile);

      // Load registry to calculate recommendations
      const registry = await electronAPI.send("models:getRegistry");
      if (registry && hwProfile) {
        // Filter models matching compute score and show top 3 recommendations
        const filtered = (registry as ModelEntry[]).filter(
          m => hwProfile.computeScore >= m.minComputeScore
        ).slice(0, 3);
        setRecommended(filtered);
      }

      // Check download queue
      const queue = await electronAPI.send("downloads:getQueue");
      if (queue) {
        setActiveDownloadCount(queue.filter((q: any) => q.status === "downloading" || q.status === "queued").length);
      }
    }
    loadData();

    const interval = setInterval(async () => {
      const hwStats = await electronAPI.send("hardware:getLiveStats");
      setStats(hwStats);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Listen to download progress changes to update state
  useEffect(() => {
    const unsubProgress = electronAPI.onDownloadProgress(async () => {
      const queue = await electronAPI.send("downloads:getQueue");
      if (queue) {
        setActiveDownloadCount(queue.filter((q: any) => q.status === "downloading" || q.status === "queued").length);
      }
    });
    return () => unsubProgress();
  }, []);

  if (!profile) {
    return (
      <div className="p-8 flex flex-col gap-6 justify-center items-center h-full">
        <div className="w-16 h-16 rounded-full border-t-2 border-accent animate-spin" />
        <span className="text-sm font-mono text-text-secondary">Detecting hardware profile...</span>
      </div>
    );
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  const cpuLoad = stats?.cpuUsage ?? 15;
  const gpuLoad = stats?.gpuUsage ?? 8;
  const ramPercent = stats ? Math.round((stats.ramUsedGB / stats.ramTotalGB) * 100) : 48;
  const vramPercent = stats && stats.vramTotalGB && stats.vramUsedGB ? Math.round((stats.vramUsedGB / stats.vramTotalGB) * 100) : 25;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 max-w-6xl mx-auto flex flex-col gap-8"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">System Dashboard</h1>
          <p className="text-xs text-text-secondary mt-1">Real-time status of your machine and model configuration.</p>
        </div>
        {activeDownloadCount > 0 && (
          <Link to="/downloads" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-mono animate-pulse hover:bg-accent/30 transition">
            <Download className="w-3.5 h-3.5" />
            <span>{activeDownloadCount} Active Download{activeDownloadCount > 1 ? "s" : ""}</span>
          </Link>
        )}
      </div>

      {/* --- HERO DIAGNOSTICS & SCORE GAUGE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hardware details card */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Device Profile</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/15 border border-accent/30 text-accent uppercase">
                {profile.backend} Enabled
              </span>
            </div>
            
            <h2 className="text-lg font-bold text-text-primary mt-2">{profile.cpu.brand}</h2>
            <p className="text-xs text-text-muted mt-0.5 font-mono">{profile.osVersion} • {profile.cpu.architecture}</p>
          </div>

          {/* Telemetry charts/meters */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">CPU Workload</span>
                <span className="text-text-primary">{cpuLoad}%</span>
              </div>
              <div className="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
                <div className="h-full bg-success transition-all duration-1000" style={{ width: `${cpuLoad}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">RAM Usage</span>
                <span className="text-text-primary">{stats?.ramUsedGB ?? 9.8} / {profile.ram.totalGB} GB</span>
              </div>
              <div className="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${ramPercent}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">GPU Utilization</span>
                <span className="text-text-primary">{gpuLoad}%</span>
              </div>
              <div className="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
                <div className="h-full bg-info transition-all duration-1000" style={{ width: `${gpuLoad}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">VRAM Occupied</span>
                <span className="text-text-primary">{stats?.vramUsedGB ?? 3.2} / {stats?.vramTotalGB ?? 12} GB</span>
              </div>
              <div className="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
                <div className="h-full bg-warning transition-all duration-1000" style={{ width: `${vramPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border/50 flex justify-between items-center text-xs font-mono">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Storage Free: {profile.disk.freeGB} GB</span>
            </div>
            <div className="text-text-muted">
              Updated live (2s)
            </div>
          </div>
        </motion.div>

        {/* Compute score gauge */}
        <motion.div variants={itemVariants} className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-accent/5 to-transparent pointer-events-none" />
          
          <span className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider mb-2">Compute Score</span>
          
          {/* Animated SVG Circle Gauge */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="52"
                strokeWidth="6"
                stroke="var(--color-bg-subtle)"
                fill="transparent"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="52"
                strokeWidth="7"
                stroke="var(--color-accent)"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 52}
                initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - profile.computeScore / 100) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-extrabold tracking-tighter text-text-primary">{profile.computeScore}</span>
              <span className="text-[10px] text-text-secondary font-mono leading-none">/ 100</span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider">{profile.tier}</h3>
            <p className="text-[10px] text-text-muted mt-1 max-w-[200px] leading-relaxed">
              Based on physical memory architectures, processing engines, and graphics hardware capacities.
            </p>
          </div>
        </motion.div>
      </div>

      {/* --- QUICK ACTION UTILITIES --- */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <h2 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionBtn 
            label="Chat Playground" 
            desc="Test chat & code LLMs" 
            icon={MessageSquare} 
            to="/playground/chat" 
          />
          <QuickActionBtn 
            label="Generate Images" 
            desc="Stable Diffusion & Flux" 
            icon={ImageIcon} 
            to="/playground/image" 
          />
          <QuickActionBtn 
            label="Transcribe Audio" 
            desc="Offline Whisper engine" 
            icon={Flame} 
            to="/playground/stt" 
          />
          <QuickActionBtn 
            label="Explore Model Hub" 
            desc="Browse and install GGUFs" 
            icon={Zap} 
            to="/hub" 
          />
        </div>
      </motion.div>

      {/* --- HARDWARE TIER RECOMMENDATIONS --- */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-2">
          <h2 className="text-xs font-bold font-mono text-text-secondary uppercase tracking-wider">Recommended for your Machine</h2>
          <span className="text-[10px] text-text-muted font-mono">Based on Tier {profile.computeScore >= 60 ? "4/5" : profile.computeScore >= 35 ? "3" : "1/2"} specs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recommended.length > 0 ? (
            recommended.map((model) => (
              <div key={model.id} className="glass-panel hover:border-border-bright rounded-xl p-5 flex flex-col justify-between transition-all duration-300 group">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-bg-subtle text-[10px] font-mono text-text-secondary font-semibold uppercase">
                      {model.category}
                    </span>
                    <span className="text-xs text-text-muted font-mono flex items-center gap-1">
                      <Zap className="w-3 h-3 text-warning" />
                      {model.minComputeScore} match
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-text-primary mt-3 group-hover:text-accent transition">{model.name}</h3>
                  <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2">{model.description}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs font-mono text-text-muted">
                    {model.variants[0]?.sizeGB} GB
                  </span>
                  <button 
                    onClick={() => navigate({ to: `/hub` })}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-accent hover:bg-accent-dim text-text-primary rounded font-medium transition cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Get Model</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8 text-xs text-text-muted">No custom recommendations found. Explore the full hub repository.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Quick action child helper
interface QuickActionProps {
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
  to: string;
}

function QuickActionBtn({ label, desc, icon: Icon, to }: QuickActionProps) {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate({ to })}
      className="glass-panel hover:bg-bg-subtle/50 text-left p-4 rounded-xl border border-border hover:border-border-bright transition duration-300 cursor-pointer flex items-start gap-3.5 group"
    >
      <div className="p-2.5 rounded-lg bg-bg-base/70 border border-border group-hover:border-accent/40 group-hover:bg-accent/5 text-accent transition shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-xs font-bold text-text-primary leading-tight">{label}</h3>
        <p className="text-[10px] text-text-secondary mt-1 leading-tight">{desc}</p>
      </div>
    </button>
  );
}
