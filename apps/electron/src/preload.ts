import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generic RPC IPC invocation
  send: (channel: string, payload?: any) => ipcRenderer.invoke("rpc-request", channel, payload),

  // Subscription callbacks
  onDownloadProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("download-progress", listener);
    return () => {
      ipcRenderer.off("download-progress", listener);
    };
  },

  onDownloadCompleted: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("download-completed", listener);
    return () => {
      ipcRenderer.off("download-completed", listener);
    };
  },

  onChatStreamChunk: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream-chunk", listener);
    return () => {
      ipcRenderer.off("chat-stream-chunk", listener);
    };
  },

  onChatStreamDone: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream-done", listener);
    return () => {
      ipcRenderer.off("chat-stream-done", listener);
    };
  },

  // Window Controls & Platform
  minimize: () => ipcRenderer.send("window-control", "minimize"),
  maximize: () => ipcRenderer.send("window-control", "maximize"),
  close: () => ipcRenderer.send("window-control", "close"),
  getPlatform: () => process.platform
});
