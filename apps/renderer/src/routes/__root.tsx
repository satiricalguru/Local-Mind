import React, { useState, useEffect } from "react";
import { createRootRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Network, 
  Download, 
  FolderLock,
  Flame, 
  Settings, 
  MessageSquare, 
  Image as ImageIcon, 
  Music, 
  Video as VideoIcon, 
  Volume2, 
  Mic, 
  GitCompare, 
  ChevronLeft, 
  ChevronRight,
  Terminal,
  Search,
  Sparkles,
  Cpu
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { HardwareLiveStats, HardwareProfile } from "@localmind/shared-types";
import { Toaster, toast } from "sonner";

export const Route = createRootRoute({
  component: RootLayout
});

function RootLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);
  const [liveStats, setLiveStats] = useState<HardwareLiveStats | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState("dark");
  const [platform, setPlatform] = useState("darwin");
  const routerState = useRouterState();
  const navigate = useNavigate();

  const applyTheme = (themeValue: string) => {
    let resolvedTheme = themeValue;
    if (themeValue === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  };

  // Load hardware profiles, theme, and stream stats
  useEffect(() => {
    async function loadProfileAndTheme() {
      const profile = await electronAPI.send("hardware:getProfile");
      setHardwareProfile(profile);

      if (electronAPI.getPlatform) {
        setPlatform(electronAPI.getPlatform());
      }

      const data = await electronAPI.send("settings:getAll");
      const currentTheme = data?.theme || "dark";
      setTheme(currentTheme);
      applyTheme(currentTheme);
    }
    loadProfileAndTheme();

    const statsInterval = setInterval(async () => {
      const stats = await electronAPI.send("hardware:getLiveStats");
      setLiveStats(stats);
    }, 2000);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
        applyTheme(customEvent.detail);
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      electronAPI.send("settings:getAll").then((data) => {
        if (data?.theme === "system") {
          applyTheme("system");
        }
      });
    };

    window.addEventListener("theme-changed", handleThemeChange);
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      clearInterval(statsInterval);
      window.removeEventListener("theme-changed", handleThemeChange);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  // Keyboard shortcut for ⌘K / Ctrl+K command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get active pulsing color based on CPU/GPU loads
  const getHeartbeatClass = () => {
    if (!liveStats) return "gpu-pulse-green";
    const load = liveStats.gpuUsage ?? liveStats.cpuUsage;
    if (load > 85) return "gpu-pulse-red";
    if (load > 55) return "gpu-pulse-amber";
    return "gpu-pulse-green";
  };

  const getSystemStatusLabel = () => {
    if (!liveStats) return "Active Monitoring";
    const load = liveStats.gpuUsage ?? liveStats.cpuUsage;
    if (load > 85) return "Heavy Computation";
    if (load > 55) return "Active Load";
    return "Idle / Waiting";
  };

  // Pre-configured command list for Command Palette
  const commands = [
    { label: "Go to Dashboard", icon: LayoutDashboard, action: () => navigate({ to: "/" }) },
    { label: "Browse Model Hub", icon: Network, action: () => navigate({ to: "/hub" }) },
    { label: "Installed Models List", icon: FolderLock, action: () => navigate({ to: "/installed" }) },
    { label: "View Active Downloads", icon: Download, action: () => navigate({ to: "/downloads" }) },
    { label: "Chat Playground", icon: MessageSquare, action: () => navigate({ to: "/playground/chat" }) },
    { label: "Image Gen Playground", icon: ImageIcon, action: () => navigate({ to: "/playground/image" }) },
    { label: "Audio Gen Playground", icon: Music, action: () => navigate({ to: "/playground/audio" }) },
    { label: "Video Gen Playground", icon: VideoIcon, action: () => navigate({ to: "/playground/video" }) },
    { label: "Speech Synthesis (TTS)", icon: Volume2, action: () => navigate({ to: "/playground/tts" }) },
    { label: "Voice Transcriber (STT)", icon: Mic, action: () => navigate({ to: "/playground/stt" }) },
    { label: "Run Hardware Benchmarks", icon: Flame, action: () => navigate({ to: "/benchmark" }) },
    { label: "Model Comparison", icon: GitCompare, action: () => navigate({ to: "/compare" }) },
    { label: "Open Settings Panel", icon: Settings, action: () => navigate({ to: "/settings" }) }
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-base text-text-primary overflow-hidden font-sans">
      <Toaster theme={theme === "light" ? "light" : "dark"} position="top-right" richColors />

      {/* --- ELECTRON CUSTOM TITLEBAR --- */}
      <div className="titlebar-drag h-10 w-full flex items-center justify-between px-4 border-b border-border bg-bg-surface/90 backdrop-blur-md select-none shrink-0 z-50">
        <div className={`flex items-center gap-2 no-drag ${platform === "darwin" ? "pl-20" : "pl-2"}`}>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-text-secondary">
            LocalMind <span className="text-accent">v1.0.0</span>
          </span>
        </div>
        <div className="no-drag flex items-center gap-2">
          <button 
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-bg-base/70 border border-border rounded-md hover:border-border-bright transition duration-200"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search actions</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-bg-subtle border border-border rounded font-mono">⌘K</kbd>
          </button>

          {/* Windows / Linux Window Controls */}
          {platform !== "darwin" && (
            <div className="flex items-center ml-2 border-l border-border/40 pl-2 gap-0.5">
              <button 
                onClick={() => electronAPI.minimize?.()}
                className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition cursor-pointer"
                title="Minimize"
              >
                <span className="w-2.5 h-[1.5px] bg-current" />
              </button>
              <button 
                onClick={() => electronAPI.maximize?.()}
                className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition cursor-pointer"
                title="Maximize"
              >
                <div className="w-2.5 h-2.5 border border-current rounded-[1px]" />
              </button>
              <button 
                onClick={() => electronAPI.close?.()}
                className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-danger/20 hover:text-danger transition cursor-pointer"
                title="Close"
              >
                <span className="font-sans text-xs">✕</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 h-full w-full overflow-hidden relative">
        {/* --- COLLAPSIBLE SIDEBAR --- */}
        <aside 
          className={`flex flex-col border-r border-border bg-bg-surface/85 backdrop-blur-lg transition-all duration-300 relative shrink-0 z-40 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Collapse toggle */}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute top-4 -right-3 w-6 h-6 border border-border bg-bg-elevated text-text-secondary hover:text-text-primary rounded-full flex items-center justify-center cursor-pointer transition hover:border-border-bright"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          {/* Logo Brand */}
          <div className={`p-5 flex items-center gap-3 border-b border-border/50 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img src={theme === "light" ? "./logo-light.png" : "./logo.png"} className="w-full h-full object-contain" alt="LocalMind Logo" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-text-primary">LocalMind</span>
                <span className="text-[10px] text-text-muted font-mono leading-none">Every model. Locally.</span>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
            <SidebarLink to="/" label="Dashboard" icon={LayoutDashboard} collapsed={collapsed} />
            <SidebarLink to="/hub" label="Model Hub" icon={Network} collapsed={collapsed} />
            <SidebarLink to="/installed" label="Installed Models" icon={FolderLock} collapsed={collapsed} />
            <SidebarLink to="/downloads" label="Downloads" icon={Download} collapsed={collapsed} />
            
            <div className="h-px bg-border/40 my-2 mx-2" />
            
            <span className={`text-[10px] font-mono text-text-muted uppercase tracking-wider px-3 mb-1.5 ${collapsed ? "text-center block" : ""}`}>
              {collapsed ? "Play" : "Playgrounds"}
            </span>
            <SidebarLink to="/playground/chat" label="Chat & Code" icon={MessageSquare} collapsed={collapsed} />
            <SidebarLink to="/playground/image" label="Image Gen" icon={ImageIcon} collapsed={collapsed} />
            <SidebarLink to="/playground/audio" label="Audio Gen" icon={Music} collapsed={collapsed} />
            <SidebarLink to="/playground/video" label="Video Gen" icon={VideoIcon} collapsed={collapsed} />
            <SidebarLink to="/playground/tts" label="Text to Speech" icon={Volume2} collapsed={collapsed} />
            <SidebarLink to="/playground/stt" label="Speech to Text" icon={Mic} collapsed={collapsed} />

            <div className="h-px bg-border/40 my-2 mx-2" />
            
            <SidebarLink to="/compare" label="Compare Models" icon={GitCompare} collapsed={collapsed} />
            <SidebarLink to="/benchmark" label="Benchmarks" icon={Flame} collapsed={collapsed} />
            <SidebarLink to="/settings" label="Settings" icon={Settings} collapsed={collapsed} />
          </nav>

          {/* GPU Heartbeat Health Gauge */}
          <div className="p-4 border-t border-border bg-bg-base/30 flex flex-col items-center shrink-0">
            <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed ${getHeartbeatClass()} transition-colors duration-300`}>
              <Cpu className="w-5 h-5 text-text-primary" />
              {liveStats && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-text-primary border border-bg-surface font-mono">
                  {liveStats.gpuUsage ?? liveStats.cpuUsage}%
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-text-secondary leading-none">
                  {hardwareProfile ? hardwareProfile.cpu.brand.split(" (")[0] : "Apple Silicon"}
                </p>
                <p className="text-[9px] text-text-muted mt-0.5 leading-none font-mono">
                  {getSystemStatusLabel()}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* --- MAIN PAGE OUTLET --- */}
        <main className="flex-1 h-full min-w-0 bg-bg-base relative overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* --- COMMAND PALETTE OVERLAY (⌘K) --- */}
      {commandPaletteOpen && (
        <div 
          className="fixed inset-0 bg-bg-base/70 backdrop-blur-sm flex justify-center pt-24 z-[100] px-4"
          onClick={() => {
            setCommandPaletteOpen(false);
            setSearchQuery("");
          }}
        >
          <div 
            className="w-full max-w-xl h-fit glass-elevated rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-text-secondary" />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or search page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredCommands.length > 0) {
                    e.preventDefault();
                    filteredCommands[0].action();
                    setCommandPaletteOpen(false);
                    setSearchQuery("");
                  }
                }}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted border-none outline-none"
              />
              <span className="text-[10px] text-text-muted px-2 py-0.5 bg-bg-subtle rounded border border-border font-mono">ESC</span>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-0.5">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        cmd.action();
                        setCommandPaletteOpen(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm text-text-secondary hover:text-text-primary hover:bg-accent/10 transition duration-150 cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-accent" />
                      <span>{cmd.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-text-muted">No commands match your query.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component Helper
interface SidebarLinkProps {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
  collapsed: boolean;
}

function SidebarLink({ to, label, icon: Icon, collapsed }: SidebarLinkProps) {
  return (
    <Link 
      to={to} 
      activeProps={{ className: "bg-accent/15 border-accent text-text-primary shadow-inner shadow-accent/5" }}
      inactiveProps={{ className: "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-subtle/50" }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 text-sm transition duration-150 relative group"
    >
      <Icon className="w-4 h-4 shrink-0 transition group-hover:scale-105" />
      {!collapsed && <span className="font-medium tracking-wide text-xs">{label}</span>}
      {collapsed && (
        <span className="absolute left-16 bg-bg-elevated border border-border px-2 py-1 rounded text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition duration-150 whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </Link>
  );
}
