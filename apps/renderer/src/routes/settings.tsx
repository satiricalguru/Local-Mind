import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Settings, 
  Cpu, 
  Download, 
  Network, 
  Trash2, 
  Info,
  Check
} from "lucide-react";
import { electronAPI } from "../lib/electron.js";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState("dark");
  const [downloadPath, setDownloadPath] = useState("~/LocalMind/models");
  const [backendOverride, setBackendOverride] = useState("auto");
  const [maxDownloads, setMaxDownloads] = useState(2);
  const [apiServerActive, setApiServerActive] = useState(false);
  const [apiPort, setApiPort] = useState(11434);
  const [hfToken, setHfToken] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const data = await electronAPI.send("settings:getAll");
      if (data) {
        if (data.theme) setTheme(data.theme);
        if (data.downloadPath) setDownloadPath(data.downloadPath);
        if (data.backendOverride) setBackendOverride(data.backendOverride);
        if (data.maxDownloads) setMaxDownloads(parseInt(data.maxDownloads));
        if (data.apiServerActive) setApiServerActive(data.apiServerActive === "true");
        if (data.apiPort) setApiPort(parseInt(data.apiPort));
        if (data.hfToken) setHfToken(data.hfToken);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (key: string, value: string) => {
    try {
      await electronAPI.send("settings:set", { key, value });
      toast.success(`Saved successfully`);
    } catch (e) {
      toast.error("Failed to update setting");
    }
  };

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    try {
      await electronAPI.send("conversations:clearAll");
      toast.success("Conversation history cleared.");
    } catch (e) {
      toast.error("Failed to clear history");
    } finally {
      setConfirmClear(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6 select-none">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            <span>App Settings</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">Configure app parameters, API servers, and system resources.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
        {/* Left tabs selector */}
        <div className="col-span-1 flex flex-col gap-1">
          <button
            onClick={() => setActiveTab("general")}
            className={`text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === "general" ? "bg-bg-subtle text-text-primary border-l-2 border-accent font-bold" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("hardware")}
            className={`text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === "hardware" ? "bg-bg-subtle text-text-primary border-l-2 border-accent font-bold" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
            }`}
          >
            Hardware & Performance
          </button>
          <button
            onClick={() => setActiveTab("downloads")}
            className={`text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === "downloads" ? "bg-bg-subtle text-text-primary border-l-2 border-accent font-bold" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
            }`}
          >
            Downloads
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === "api" ? "bg-bg-subtle text-text-primary border-l-2 border-accent font-bold" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
            }`}
          >
            API & Server
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === "privacy" ? "bg-bg-subtle text-text-primary border-l-2 border-accent font-bold" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
            }`}
          >
            Privacy
          </button>
        </div>

        {/* Right configuration sheet */}
        <div className="col-span-3 glass-panel rounded-xl p-6 flex flex-col gap-6">
          {activeTab === "general" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider border-b border-border/40 pb-2">General Config</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">App Interface Theme</label>
                <select
                  value={theme}
                  onChange={(e) => {
                    const newTheme = e.target.value;
                    setTheme(newTheme);
                    handleSave("theme", newTheme);
                    window.dispatchEvent(new CustomEvent("theme-changed", { detail: newTheme }));
                  }}
                  className="bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 px-3 text-xs text-text-primary outline-none cursor-pointer"
                >
                  <option value="dark">GPU-Noir Dark (Recommended)</option>
                  <option value="light">Vanilla Light</option>
                  <option value="system">System Default</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Model Download Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={downloadPath}
                    onChange={(e) => setDownloadPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSave("downloadPath", downloadPath);
                      }
                    }}
                    className="flex-1 bg-bg-base/70 border border-border rounded-lg py-2 px-3 text-xs text-text-primary outline-none"
                  />
                  <button 
                    onClick={() => handleSave("downloadPath", downloadPath)}
                    className="px-3 bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "hardware" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider border-b border-border/40 pb-2">Hardware Tuning</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Compute Acceleration Backend</label>
                <select
                  value={backendOverride}
                  onChange={(e) => {
                    setBackendOverride(e.target.value);
                    handleSave("backendOverride", e.target.value);
                  }}
                  className="bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 px-3 text-xs text-text-primary outline-none cursor-pointer"
                >
                  <option value="auto">Auto-Tune Acceleration (Metal/CUDA)</option>
                  <option value="cpu">Force CPU Threads only</option>
                  <option value="vulkan">Force Vulkan Runtime</option>
                </select>
                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed font-mono">
                  Auto-Tune selects the maximum parallel acceleration driver for your hardware layout.
                </p>
              </div>
            </div>
          )}

          {activeTab === "downloads" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider border-b border-border/40 pb-2">Download Options</h3>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Simultaneous Downloads</span>
                  <span className="text-text-primary font-bold">{maxDownloads} queue</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={maxDownloads}
                  onChange={(e) => {
                    setMaxDownloads(parseInt(e.target.value));
                    handleSave("maxDownloads", e.target.value);
                  }}
                  className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider border-b border-border/40 pb-2">API Endpoints</h3>
              
              <label className="flex items-center gap-2.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={apiServerActive}
                  onChange={(e) => {
                    setApiServerActive(e.target.checked);
                    handleSave("apiServerActive", e.target.checked ? "true" : "false");
                  }}
                  className="rounded border-border text-accent focus:ring-accent bg-bg-base"
                />
                <span>Enable local OpenAI-compatible REST server</span>
              </label>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Server Port</label>
                <input
                  type="number"
                  value={apiPort}
                  onChange={(e) => {
                    setApiPort(parseInt(e.target.value));
                    handleSave("apiPort", e.target.value);
                  }}
                  className="bg-bg-base/70 border border-border focus:border-border-bright rounded-lg py-2 px-3 text-xs text-text-primary outline-none"
                />
                <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                  Turns LocalMind into a drop-in replacement for OpenAI / Ollama packages. Exposes `/v1/chat/completions`.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Hugging Face API Access Token (for gated models)</label>
                <input
                  type="password"
                  value={hfToken}
                  onChange={(e) => {
                    setHfToken(e.target.value);
                    handleSave("hfToken", e.target.value);
                  }}
                  className="bg-bg-base/70 border border-border rounded-lg py-2 px-3 text-xs text-text-primary outline-none"
                  placeholder="hf_..."
                />
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold font-mono text-text-primary uppercase tracking-wider border-b border-border/40 pb-2">Privacy & Cleaning</h3>
              
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  All metrics, chats, and image generation records remain stored completely on your local SQLite storage path.
                </p>
                <button
                  onClick={handleClearHistory}
                  className={`w-fit py-2 px-4 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    confirmClear 
                      ? "border-danger bg-danger/20 text-danger hover:bg-danger/30" 
                      : "border-danger/40 bg-danger/5 hover:bg-danger/10 text-danger"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmClear ? "Confirm Delete (click again)" : "Clear Conversation Logs"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
