import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { DatabaseManager } from "./services/DatabaseManager.js";
import { DownloadManager } from "./services/DownloadManager.js";
import { IPCRouter } from "./trpc/router.js";

// Catch all uncaught exceptions and unhandled rejections to prevent crashing popup alerts
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception in Main Process:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// global __dirname is used for CommonJS compilation output

let mainWindow: BrowserWindow | null = null;
let db: DatabaseManager;
let downloadManager: DownloadManager;
let router: IPCRouter;

function createWindow() {
  db = new DatabaseManager();
  downloadManager = new DownloadManager();
  router = new IPCRouter(db, downloadManager);

  // Expose webContents to router for broadcasting progress/token events
  router.webContentsProvider = () => {
    return mainWindow ? [mainWindow.webContents] : [];
  };

  const iconPath = path.join(__dirname, "../assets/icon.png");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false, // frameless custom chrome
    titleBarStyle: "hiddenInset", // native Mac traffic light layout
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: "#0A0A0F"
  });

  // Load Vite dev server if running in development mode
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../../renderer/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Request Router handler
ipcMain.handle("rpc-request", async (_event, channel: string, payload: any) => {
  if (!router) {
    return { error: "Router not initialized yet" };
  }
  return await router.handleRequest(channel, payload);
});

// Window Controls handler
ipcMain.on("window-control", (event, action) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) return;

  if (action === "minimize") {
    win.minimize();
  } else if (action === "maximize") {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  } else if (action === "close") {
    win.close();
  }
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    try {
      const iconPath = path.join(__dirname, "../assets/icon.png");
      if (fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
      }
    } catch (e) {
      console.error("Failed to set macOS dock icon:", e);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
