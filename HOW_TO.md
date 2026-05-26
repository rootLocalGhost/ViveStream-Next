# ViveStream-Next: Architecture & Methodology (HOW_TO.md)

This document explains the core philosophy, technical architecture, and specific workarounds used in ViveStream-Next. It serves as a guide for why certain decisions were made, especially regarding app size optimization and YouTube's anti-bot mitigation.

## 1. What We Are Doing

We are building a highly optimized, native desktop YouTube downloader and media player for Windows and Linux.
The core objective is to maintain a **minimal application footprint** while leveraging **hardware-accelerated GPU transcoding** (Intel QSV, NVIDIA NVENC, VAAPI) for optimal performance.

### The Stack

- **Frontend:** SolidJS (Chosen for extreme performance and lack of Virtual DOM overhead).
- **Backend/Wrapper:** Tauri v2 with Rust (Chosen over Electron to avoid shipping a bundled Chromium engine, keeping the app size under 15MB).
- **Core Engines:** `yt-dlp` (Extraction) and `FFmpeg` (Transcoding).

---

## 2. How We Are Doing It (And Why)

### Post-Install Dependency Fetching vs. Bundling

**Decision:** We DO NOT bundle `yt-dlp` or `FFmpeg` inside the Tauri installer. Instead, the Rust backend fetches these binaries from GitHub directly to the user's `app_data` directory on the first launch.
**Why:**

1. **App Size:** Bundling Windows and Linux binaries for FFmpeg and yt-dlp would bloat the app installer from ~10MB to over 150MB. This defeats the purpose of using Tauri.
2. **The Update Cycle:** YouTube changes its API weekly. `yt-dlp` updates constantly to patch these changes. By keeping `yt-dlp` decoupled from the app, we can update the extractor silently in the background without forcing the user to download and install a completely new `ViveStream-Next` app release.

### Sourcing the Binaries

- **yt-dlp:** We fetch directly from the `yt-dlp-nightly-builds` repository. Standard releases update monthly; Nightly builds give us 24-hour response times to YouTube API changes.
- **FFmpeg (Linux):** We use `BtbN/FFmpeg-Builds` (`.tar.xz`). We previously attempted to use John Van Sickle's static builds, but Cloudflare's anti-bot protection blocks automated terminal downloads. BtbN is hosted on GitHub Releases and does not block automated `reqwest` calls.
- **FFmpeg (Windows):** We use a custom zip containing a QSV/NVENC optimized build.

---

## 3. The Anti-Bot War: What We Are Doing

YouTube actively fights automated scrapers using IP trust scores and a cryptographic validation system called BotGuard, which generates Proof of Origin (PO) Tokens.

### The `web_safari` and `web_embedded` API Strategy

**Decision:** We actively strip out standard API clients (`android`, `ios`, `web`) from `yt-dlp` and force it to use `web_safari` and `web_embedded`.
**Why:** Google owns Chrome and Android, allowing them to strictly enforce BotGuard JS scripts to verify human users. If you do not pass a PO Token on these clients, YouTube throttles the video to 144p (SABR formats).
However, Apple's ecosystem (Safari/iOS) relies on Apple's proprietary HLS (`.m3u8`) streaming protocol. Google has not yet found a reliable way to enforce strict PO Tokens on HLS streams without breaking native playback for millions of legitimate Mac users. By disguising our requests as a Safari client, we bypass the PO Token requirement entirely and access 1080p/4K streams.

---

## 4. What We Are NOT Doing (And Why)

It is tempting to try and brute-force YouTube's bot protection. We explicitly avoid the following methods due to severe architectural or safety consequences.

### 🚫 We are NOT faking telemetry or using headless browsers

**The Idea:** "Let's spin up a hidden browser, fake mouse movements, pass the BotGuard math challenges, generate a PO Token, and send it to yt-dlp."
**Why we don't do it:** To execute YouTube's highly obfuscated JavaScript, we would have to bundle a full headless browser engine (like Puppeteer or Playwright) into the app. This requires shipping Chromium. It would instantly bloat the app size by 150MB+, destroy system RAM, and completely ruin the lightweight architecture Tauri provides.

### 🚫 We are NOT using the user's browser cookies (By Default)

**The Idea:** "Let's just pass `--cookies-from-browser chrome` to yt-dlp so YouTube sees a logged-in, verified human."
**Why we don't do it:** If a user logs into their personal Google account, their cookies are tied to their identity. If ViveStream uses those cookies to aggressively download hundreds of videos, YouTube will not just block the IP address—they will permanently ban the user's actual Google Account for violating Terms of Service. We will not risk our users' personal accounts to bypass a scraper block.

## 5. Maintenance Protocol

If downloads suddenly fail or return 144p video, the protocol is:

1. Check the `yt-dlp` GitHub Issues page for ongoing API changes.
2. Verify the Nightly build has been updated.
3. Adjust the `--extractor-args` in `src-tauri/src/lib.rs` to pivot to a new loophole client (e.g., `tv`, `mweb`, or VR clients) if Apple HLS streams get locked down.
