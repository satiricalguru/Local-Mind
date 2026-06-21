import React, { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  MessageSquare, 
  Send, 
  Cpu, 
  Settings2, 
  Plus, 
  Trash2, 
  Gauge, 
  Zap, 
  User, 
  Bot, 
  BookOpen,
  Clipboard,
  CornerDownLeft,
  ChevronDown
} from "lucide-react";
import { electronAPI } from "../../lib/electron.js";
import { Conversation, Message, ModelEntry } from "@localmind/shared-types";
import { toast } from "sonner";

export const Route = createFileRoute("/playground/chat")({
  component: ChatPlayground
});

function ChatPlayground() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  
  // Model inference configurations
  const [temperature, setTemperature] = useState(0.7);
  const [contextLength, setContextLength] = useState(2048);
  const [maxTokens, setMaxTokens] = useState(512);
  const [gpuLayers, setGpuLayers] = useState(-1);
  const [threads, setThreads] = useState(4);
  const [showParams, setShowParams] = useState(true);

  // Live stats of active message
  const [liveStats, setLiveStats] = useState<{ tps: number; ttft: number; tokens: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadModels();
    loadConversations();

    // Bind stream chunk listener
    const unsubChunk = electronAPI.onChatStreamChunk((data) => {
      setStreamingText((prev) => prev + data.text);
    });

    const unsubDone = electronAPI.onChatStreamDone((data) => {
      setIsGenerating(false);
      setStreamingText("");
      if (data.message) {
        setMessages((curr) => [...curr, data.message]);
        setLiveStats(data.message.stats || null);
      }
      loadConversations();
    });

    return () => {
      unsubChunk();
      unsubDone();
    };
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const loadModels = async () => {
    const data = await electronAPI.send("models:getInstalled");
    const chatOnly = (data || []).filter((m: any) => m.category === "chat" || m.category === "code");
    setInstalledModels(chatOnly);
    if (chatOnly.length > 0) {
      setSelectedModelId(chatOnly[0].id);
    }
  };

  const loadConversations = async () => {
    const data = await electronAPI.send("conversations:list");
    setConversations(data || []);
    if (data && data.length > 0 && !activeConvId) {
      setActiveConvId(data[0].id);
    }
  };

  const loadMessages = async (convId: string) => {
    const data = await electronAPI.send("conversations:getMessages", { conversationId: convId });
    setMessages(data || []);
    setLiveStats(null);
  };

  const handleCreateChat = async () => {
    if (!selectedModelId) {
      toast.error("Please download a chat model first");
      return;
    }
    const model = installedModels.find(m => m.id === selectedModelId);
    const title = `Chat with ${model?.name || "Assistant"}`;
    const conv = await electronAPI.send("conversations:create", { 
      title, 
      modelId: selectedModelId 
    });
    if (conv) {
      setConversations(curr => [conv, ...curr]);
      setActiveConvId(conv.id);
    }
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await electronAPI.send("conversations:delete", { id });
    toast.info("Conversation deleted");
    if (activeConvId === id) {
      setActiveConvId("");
    }
    loadConversations();
  };

  const handleSendMessage = async () => {
    if (!inputMsg.trim() || isGenerating) return;

    let convId = activeConvId;
    if (!convId) {
      if (!selectedModelId) {
        toast.error("Please download and select a model first");
        return;
      }
      const model = installedModels.find(m => m.id === selectedModelId);
      const title = `Chat with ${model?.name || "Assistant"}`;
      const conv = await electronAPI.send("conversations:create", { 
        title, 
        modelId: selectedModelId 
      });
      if (conv) {
        setConversations(curr => [conv, ...curr]);
        setActiveConvId(conv.id);
        convId = conv.id;
      } else {
        toast.error("Failed to auto-create conversation thread");
        return;
      }
    }

    const userText = inputMsg;
    setInputMsg("");

    // Add user message
    const userMsg = await electronAPI.send("conversations:addMessage", {
      conversationId: convId,
      role: "user",
      content: userText,
      modelId: selectedModelId
    });

    setMessages((curr) => [...curr, userMsg]);
    setIsGenerating(true);
    setStreamingText("");
    setLiveStats(null);

    // Call stream IPC
    try {
      const history = [...messages, userMsg];
      await electronAPI.send("inference:streamCompletion", {
        conversationId: convId,
        messages: history,
        modelId: selectedModelId,
        params: {
          temperature,
          contextLength,
          maxTokens,
          gpuLayers,
          threads
        }
      });
    } catch (e) {
      setIsGenerating(false);
      toast.error("Inference execution crashed");
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex h-full w-full bg-bg-base overflow-hidden">
      
      {/* --- LEFT CONVERSATIONS BAR --- */}
      <aside className="w-56 border-r border-border bg-bg-surface/20 flex flex-col justify-between shrink-0 overflow-y-auto select-none">
        <div className="p-4 flex flex-col gap-3">
          <button 
            onClick={handleCreateChat}
            className="w-full py-2 bg-accent hover:bg-accent-dim text-text-primary text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          <div className="h-px bg-border/40 my-1" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold font-mono text-text-secondary uppercase tracking-wider px-2">History</span>
            {conversations.length > 0 ? (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between group transition cursor-pointer ${
                    activeConvId === c.id 
                      ? "bg-bg-subtle text-text-primary" 
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle/30"
                  }`}
                >
                  <span className="truncate pr-2">{c.title}</span>
                  <Trash2 
                    onClick={(e) => handleDeleteChat(c.id, e)}
                    className="w-3.5 h-3.5 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition shrink-0 cursor-pointer" 
                  />
                </button>
              ))
            ) : (
              <span className="text-[10px] text-text-muted italic px-2 py-4">No chat history.</span>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-bg-base/30">
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
                <option value="">No chat model installed</option>
              )}
            </select>
          </div>
        </div>
      </aside>

      {/* --- CENTER CHAT PANEL --- */}
      <section className="flex-1 flex flex-col justify-between min-w-0 bg-bg-base relative">
        {/* Chat message list */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.length > 0 || streamingText ? (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
                  <div className={`p-2 rounded-lg border shrink-0 ${
                    msg.role === "user" ? "bg-accent/15 border-accent/20 text-accent" : "bg-bg-surface border-border text-info"
                  }`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : ""}`}>
                    <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed border ${
                      msg.role === "user" 
                        ? "bg-accent/10 border-accent/20 text-text-primary" 
                        : "bg-bg-surface/75 border-border/80 text-text-primary"
                    }`}>
                      {/* Full Markdown Rendering Simulation */}
                      <pre className="whitespace-pre-wrap font-sans text-xs">{msg.content}</pre>
                    </div>

                    {msg.role === "assistant" && msg.stats && (
                      <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono">
                        <span>Speed: {msg.stats.tps} t/s</span>
                        <span>TTFT: {msg.stats.ttft}ms</span>
                        <button onClick={() => handleCopyText(msg.content)} className="hover:text-text-primary transition flex items-center gap-0.5 cursor-pointer">
                          <Clipboard className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming placeholder bubble */}
              {streamingText && (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="p-2 rounded-lg border border-border bg-bg-surface text-info shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="rounded-xl px-4 py-3 text-xs leading-relaxed border bg-bg-surface/75 border-border/80 text-text-primary">
                      <pre className="whitespace-pre-wrap font-sans text-xs">{streamingText}</pre>
                      <span className="inline-block w-1.5 h-3 bg-accent ml-0.5 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center">
              <MessageSquare className="w-12 h-12 text-text-muted animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-text-primary">Local Chat playground</h3>
                <p className="text-xs text-text-secondary max-w-sm mt-1">
                  Start a conversation thread to run offline model inference using GGUF parameters.
                </p>
              </div>
              {installedModels.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-lg mt-2">
                  <span>No installed models. Go to Hub to download Llama 3.2 or Qwen.</span>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-5 border-t border-border/50 bg-bg-surface/50 backdrop-blur-md flex flex-col gap-2 shrink-0">
          <div className="flex gap-3">
            <textarea
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything or generate script code (Shift+Enter for newline)..."
              disabled={isGenerating}
              rows={2}
              className="flex-1 bg-bg-base/70 border border-border focus:border-border-bright rounded-xl py-3 px-4 text-xs text-text-primary placeholder-text-muted outline-none resize-none transition"
            />
            
            <button
              onClick={handleSendMessage}
              disabled={isGenerating || !inputMsg.trim()}
              className="px-4 bg-accent hover:bg-accent-dim disabled:bg-bg-subtle text-text-primary hover:text-text-primary disabled:text-text-muted rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-between items-center text-[10px] text-text-muted font-mono px-1">
            <span>Enterprise parameters override enabled.</span>
            <div className="flex items-center gap-3">
              {!showParams && (
                <button
                  onClick={() => setShowParams(true)}
                  className="flex items-center gap-1 hover:text-text-primary transition cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Parameters</span>
                </button>
              )}
              <span>Enter to Send</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- RIGHT PARAMETERS OVERLAY --- */}
      {showParams && (
        <aside className="w-64 border-l border-border bg-bg-surface/15 p-5 flex flex-col gap-6 select-none shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-1.5 text-text-primary font-bold">
              <Settings2 className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider">Parameters</span>
            </div>
            <button 
              onClick={() => setShowParams(false)}
              className="text-[10px] text-text-muted hover:text-text-primary transition"
            >
              Close
            </button>
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Temperature</span>
                <span className="text-text-primary font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Context Limit</span>
                <span className="text-text-primary font-bold">{contextLength} tokens</span>
              </div>
              <input
                type="range"
                min="512"
                max="8192"
                step="256"
                value={contextLength}
                onChange={(e) => setContextLength(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">Max Generation</span>
                <span className="text-text-primary font-bold">{maxTokens} tokens</span>
              </div>
              <input
                type="range"
                min="64"
                max="2048"
                step="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">GPU Layers Offload</span>
                <span className="text-text-primary font-bold">{gpuLayers === -1 ? "Auto" : gpuLayers}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="64"
                step="1"
                value={gpuLayers}
                onChange={(e) => setGpuLayers(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-secondary">CPU Threads</span>
                <span className="text-text-primary font-bold">{threads} threads</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value))}
                className="w-full h-1 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>

          {/* Telemetry output reports */}
          {liveStats && (
            <div className="glass-panel rounded-lg p-4 flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-accent animate-pulse" />
                <span className="text-[10px] font-bold font-mono text-text-primary uppercase tracking-wider">Inference Stats</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Generation Speed</span>
                  <span className="text-success font-bold">{liveStats.tps} t/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Time to First Token</span>
                  <span className="text-text-primary">{liveStats.ttft} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Tokens Gen</span>
                  <span className="text-text-primary">{liveStats.tokens}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

    </div>
  );
}
