<img src="./src/assets/Banner.png" alt="ViveStream Banner">

![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D6?logo=tauri&logoColor=white)
![SolidJS](https://img.shields.io/badge/SolidJS-v1-2C4F7C?logo=solid&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-v1.8-000000?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-red)

Lightning-fast, native YouTube downloader and local media library. Built on Tauri v2 & SolidJS for maximum performance, hardware acceleration, and zero bloat.

## ✨ Features

- 🚀 **Smart GPU Transcoding:** Intelligent fallback matrix (Intel QSV ➔ NVIDIA NVENC ➔ VAAPI ➔ CPU). Highly optimized for Intel Arc architecture.
- 🎯 **Dynamic Quality:** Requests up to 4K, automatically steps down if unavailable.
- 🎨 **Immersive UI:** Frameless design, auto-hiding titlebar, and pure CSS-animated icons (Zero JS overhead).
- ⚡ **WebKit Bug Bypass:** Local Rust `warp` server ensures flawless Linux playback, avoiding `asset://` protocol crashes.
- 🗄️ **Absolute Privacy:** 100% offline JSON database. No cloud, no telemetry, no tracking.

---

## 📦 Installation

### 🐧 Arch Linux / Manjaro (Recommended)

Native `PKGBUILD`. Automatically resolves hardware-acceleration drivers, compiles, and safely installs via `pacman`.

```bash
wget https://raw.githubusercontent.com/rootlocalghost/ViveStream-Next/main/PKGBUILD
makepkg -si
```

### 🪟 Windows & Debian/Ubuntu

Download the latest `.exe` or `.deb` from the [Releases](https://www.google.com/search?q=https://github.com/rootlocalghost/ViveStream-Next/releases) page.

> ⚠️ **Security Prompt:** ViveStream is free and non-commercial, so it lacks paid corporate code-signing certificates.
>
> - **Windows:** Click **More Info ➔ Run Anyway** on SmartScreen.
> - **Linux:** Right-click ➔ Properties ➔ **Allow executing file as program**.

---

## 🛠️ Developer Setup

**Prerequisites:** [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and OS build tools.
_(Arch users: `sudo pacman -S base-devel webkit2gtk-4.1 curl wget unzip`)_

```bash
# 1. Clone & Install Dependencies
git clone https://github.com/rootlocalghost/ViveStream-Next.git
cd ViveStream-Next
bun install

# 2. Start Development Server
bun run tauri dev
# Note: If screen is blank on Wayland/Hyprland, force X11:
# WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 bun run tauri dev

# 3. Compile Release Binary
bun run tauri build

```

---

## ⚖️ License

**PolyForm Noncommercial License 1.0.0**
This project is free to use, modify, and build upon for personal, educational, and non-commercial purposes.

**You may not use this software for any commercial purpose.** This includes, but is not limited to: selling the software, locking features behind a paywall, incorporating it into a business product, or distributing it with advertisements.
See the [`LICENSE`](./LICENSE) file for the full text.

_Disclaimer: This tool is intended for personal archival of media you have the right to download. The developers are not responsible for how users utilize this software._
