# 🧠 LocalMind

[![pnpm](https://img.shields.io/badge/package%20manager-pnpm-F6871F?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Electron](https://img.shields.io/badge/desktop--shell-Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/frontend-React--Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/styling-TailwindCSS%20v4-38BDF8?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/database-SQLite--better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)

> **Every model. Your machine.**  
> LocalMind is a state-of-the-art, 100% private, and local desktop companion for running LLMs, Speech-to-Text (ASR), Text-to-Speech (TTS), image generators, audio, and video synthesis offline on your hardware.

---

## ✨ Features

- 💻 **Cross-Platform Frameless Window**: Native macOS titlebar integration ( traffic lights hidden inset) and custom Windows/Linux window controls (Minimize, Maximize, Close).
- 💬 **Interactive Playgrounds**:
  - **Chat & Code**: Chat with local models, streaming tokens with live performance metrics (Tokens Per Second, Time to First Token) and hardware acceleration indicators.
  - **Image Gen**: Create high-fidelity visual assets locally.
  - **Audio & Video Gen**: Synthesize soundtrack loops and visual clips offline.
  - **Voice Transcription (STT)**: High-speed speech-to-text powered by local Whisper engines with interactive audio file uploaders and live microphone support.
  - **Speech Synthesis (TTS)**: Convert text to high-quality audio files using offline voice styles.
- ⚡ **Model Hub**: One-click download and management of optimized model weights (GGUF, GGML, ONNX) directly from HuggingFace.
- ⚙️ **Advanced Settings**:
  - **App Interface Themes**: GPU-Noir Dark Mode, system-matching settings, and a custom light **Vanilla Light** theme.
  - **Download Tuning**: Throttle simultaneous queue limits and redirect storage paths dynamically (e.g. `~/LocalMind/models`).
  - **Hardware Acceleration**: Switch between Auto-Tuned (Metal/CUDA), forced CPU-only, or forced Vulkan acceleration backends.
- 📊 **Benchmarks & Monitor**: Stream real-time CPU, RAM, GPU, VRAM, and temperature telemetry directly inside the sidebar heartbeat gauge.

---

## 🏗️ Repository Architecture

LocalMind is structured as a monorepo powered by `pnpm` and `turborepo` for rapid development and builds:

```
├── apps/
│   ├── electron/        # Electron Main Process (IPC Router, DatabaseManager, DownloadManager)
│   └── renderer/        # React + Vite + TanStack Router (App Playgrounds & Settings UI)
├── packages/
│   ├── registry-schema/ # HuggingFace model catalogs and metadata declarations
│   └── shared-types/    # TypeScript type definitions shared across Main/Renderer
```

---

## 🛠️ Technology Stack

- **Core Desktop**: Electron (frameless native windows, preload context bridge)
- **Frontend Layer**: React 18, Vite, TanStack Router (type-safe file-routing)
- **Styling**: Tailwind CSS v4 (using clean CSS variables and premium Glassmorphic panel filters)
- **Database**: SQLite (powered by `better-sqlite3` with an automatic JSON-database fallback if SQLite bindings fail to load)
- **Package Manager**: pnpm (workspace filters)
- **Build Engine**: Turborepo

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/your-username/localmind.git
cd localmind
pnpm install
```

### Running Local Development
To launch the Vite frontend server and start the Electron application concurrently:
```bash
pnpm dev
```

### Building the Project
To compile the packages and build the distribution assets:
```bash
pnpm build
```

---

## 🎨 Design Theme Customization

LocalMind implements a custom CSS-variable theme engine. The styles are defined inside `apps/renderer/src/styles/index.css` and can be overridden by targeting the `data-theme` attribute:

- **GPU-Noir Dark**: Dark theme optimized for deep black OLED displays and neon accents.
- **Vanilla Light**: Pure white background surfaces with soft borders and light glassmorphism.

---

## 🔒 Privacy & Security

All conversations, audio recordings, generations, settings, and downloaded models are stored **completely locally** on your machine:
- Database path: `~/LocalMind/localmind.db`
- Models path: Configurable (defaults to `~/LocalMind/models`)
- **No external telemetry, cloud tracking, or network callbacks.**

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
