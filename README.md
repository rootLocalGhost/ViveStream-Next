<img src="./src/assets/Banner.png" alt="ViveStream Banner">

![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D6?logo=tauri&logoColor=white)
![SolidJS](https://img.shields.io/badge/SolidJS-v1-2C4F7C?logo=solid&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-v1.8-000000?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-red)

ViveStream is a lightning-fast, natively integrated YouTube downloader and local media library. Built on **Tauri v2** and **SolidJS**, it prioritizes performance, utilizing a multi-tiered hardware-accelerated FFmpeg transcoding matrix to ensure the fastest possible downloads regardless of your GPU.

## ✨ Key Features

* 🚀 **Smart Hardware Transcoding:** Automatically detects and utilizes your GPU for transcoding video. Features a robust fallback matrix:
  1. Intel Quick Sync Video (QSV) - *Optimized for Arc GPUs*
  2. NVIDIA NVENC
  3. AMD / Generic Linux (VAAPI)
  4. CPU Fallback (libx264)
* 🎯 **Intelligent Quality Selection:** Request resolutions from 720p up to 4K. If a requested resolution isn't available, ViveStream automatically steps down to the next best quality.
* 🎨 **Immersive UI:** A completely custom, distraction-free window frame with an auto-hiding title bar, expandable sidebar, and lightweight CSS-animated icons.
* ⚡ **Bypass WebKit Limitations:** Uses a dedicated internal Rust `warp` HTTP server to serve video chunks, completely bypassing the notorious Linux WebKitGTK `asset://` protocol bugs for flawless local playback.
* 🗄️ **Offline Library:** Stores all metadata locally in a resilient JSON database. No cloud sync, no tracking, pure privacy.

---

## 🛠️ Tech Stack

* **Frontend:** SolidJS, TypeScript, Vite, CSS Modules
* **Backend:** Rust, Tauri v2 API
* **Engines:** `yt-dlp` (downloading & metadata), `ffmpeg` (transcoding & remuxing)

---

## 📦 Prerequisites

Because ViveStream interacts deeply with your native operating system to handle hardware transcoding, you must have the following dependencies installed on your machine and accessible in your system `PATH`:

1. **[Node.js](https://nodejs.org/) or [Bun](https://bun.sh/)** (For frontend tooling)
2. **[Rust & Cargo](https://rustup.rs/)** (For the Tauri backend)
3. **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** (Core downloading engine)
4. **[FFmpeg](https://ffmpeg.org/)** (For media muxing and transcoding)

### 🐧 Linux Specifics (Arch/Manjaro)
Ensure you have the proper media codecs and drivers installed for hardware acceleration. For Intel GPUs (like the Arc A770), ensure you have:
```bash
sudo pacman -S yt-dlp ffmpeg intel-media-driver libva-utils gst-plugins-good gst-plugins-bad gst-plugins-ugly

```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rootlocalghost/ViveStream-Next.git
cd ViveStream-Next

```

### 2. Install dependencies

```bash
bun install

```

### 3. Run in Development Mode

This will start the Vite frontend server and compile the Rust backend.

```bash
bun run tauri dev

```

### 4. Build for Production

To compile a highly optimized, standalone executable for your operating system:

```bash
bun run tauri build

```

The compiled binary will be located in `src-tauri/target/release/`.

---

## ⚖️ License

**PolyForm Noncommercial License 1.0.0**

This project is free to use, modify, and build upon for personal, educational, and non-commercial purposes.

**You may not use this software for any commercial purpose.** This includes, but is not limited to: selling the software, locking features behind a paywall, incorporating it into a business product, or distributing it with advertisements.

See the [LICENSE](https://www.google.com/search?q=./LICENSE) file for the full text.

---

*Disclaimer: This tool is intended for personal archival of media you have the right to download. The developers are not responsible for how users utilize this software.*

```

```