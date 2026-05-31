<div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 5px;">
<img src="./src/assets/Banner.png" alt="ViveStream Banner">

![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D6?logo=tauri&logoColor=white)
![SolidJS](https://img.shields.io/badge/SolidJS-v1-2C4F7C?logo=solid&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-v1.8-000000?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-red)

Lightning-fast, native YouTube downloader and local media library. Built on Tauri v2 & SolidJS for maximum performance, hardware acceleration, and a purely tactile claymorphism interface.

</div>

## 🚀 Core Features

- ⚙️ **Smart Hardware Transcoding**
- 🎯 **Intelligent Quality Selection**
- 🎨 **Pure Claymorphism UI (Sunset/Crimson)**
- ⚡ **Flawless Local Playback**
- 🗄️ **Absolute Privacy**

---

## 📦 Installation

### 🐧 Arch Linux / Manjaro (Recommended)

```bash
wget https://raw.githubusercontent.com/rootlocalghost/ViveStream-Next/main/PKGBUILD
makepkg -si

```

### 🪟 Windows & Debian/Ubuntu

Download the latest `.exe` or `.deb` installer directly from the **[Releases](https://www.google.com/search?q=https://github.com/rootlocalghost/ViveStream-Next/releases)** page.

> ⚠️ **Important Security Prompt:** ViveStream is a free, non-commercial open-source project. Because we do not monetize users, we do not pay the extortionate fees for corporate Microsoft/Apple code-signing certificates.
>
> - **Windows Defender SmartScreen:** Click **More Info** ➔ **Run Anyway**.
> - **Linux:** Right-click the binary ➔ **Properties** ➔ Check **Allow executing file as program**.

#### 🗑️ Uninstallation & App Data Wipe

Because core engines (`yt-dlp`/`ffmpeg`) and video files are downloaded at runtime, OS uninstallers will leave them behind.

- **Fix:** Before uninstalling the app from your OS, open ViveStream, go to **Settings ➔ Danger Zone**, and execute a **Nuclear Wipe** to safely destroy all gigabytes of media and app data.

---

## 💻 Developer Setup

To compile the application from source, you need **[Bun](https://www.google.com/search?q=https://bun.sh/)**, **[Rust & Cargo](https://www.google.com/search?q=https://rustup.rs/)**, and your OS build tools.
_(Arch Linux users: `sudo pacman -S base-devel webkit2gtk-4.1 curl wget unzip`)_

1. **Clone the repository:**

```bash
git clone https://github.com/rootlocalghost/ViveStream-Next.git
cd ViveStream-Next
```

2. **Install dependencies:**

```bash
bun install
# or
bun run init
```

3. **Run in Development Mode:**

```bash
bun start
```

Note: If you experience a blank/white screen on Linux Wayland (Hyprland), force XWayland rendering by running: `WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 bun run tauri dev`

4. **Build for Production:**

```bash
bun run tauri build
```

---

## 🤝 Contributing

Contributions are always welcome. Keep the architecture light and the dependencies strictly minimized.

1. Fork the repo.
2. Create your feature branch (`git checkout -b feature/Optimization`).
3. Commit your changes (`git commit -m 'feat: Added Optimization'`).
4. Push to the branch (`git push origin feature/Optimization`).
5. Open a Pull Request.

## ⚖️ License

**PolyForm Noncommercial License 1.0.0**

This project is free to use, modify, and build upon for personal, educational, and non-commercial purposes.
**You may not use this software for any commercial purpose.** This includes, but is not limited to: selling the software, locking features behind a paywall, incorporating it into a business product, or distributing it with advertisements.

See the [`LICENSE`](./LICENSE) file for the full text.

_Disclaimer: This tool is intended for personal archival of media you have the right to download. The developers are not responsible for how users utilize this software._
