# ViveStream-Next: Architecture & Methodology (HOW_TO.md)

This document explains the core philosophy, technical architecture, and specific workarounds used in ViveStream-Next. It serves as a guide for why certain decisions were made, especially regarding app size optimization and YouTube's anti-bot mitigation.

## 1. What We Are Doing

We are building a highly optimized, native desktop YouTube downloader and media player for Windows and Linux. The core objective is to maintain a **minimal application footprint** while leveraging **hardware-accelerated GPU transcoding** (Intel QSV, NVIDIA NVENC, VAAPI) for optimal performance.

### The Stack

- **Frontend:** SolidJS (Chosen for extreme performance and lack of Virtual DOM overhead).
- **Backend/Wrapper:** Tauri v2 with Rust (Chosen over Electron to avoid shipping a bundled Chromium engine, keeping the app size under 15MB).
- **Local Server:** Internal `warp` server routing media from the local filesystem to the frontend on port `1422`.
- **Database:** SQLite via `rusqlite` tracking metadata for immediate offline retrieval.
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
- **Deno:** We fetch the standalone `deno` JS runtime to execute YouTube's cryptographic JavaScript challenges locally.
- **bgutil-pot:** A native Rust executable used to mathematically generate Proof of Origin (PO) tokens.

---

## 3. The Anti-Bot War & Workarounds

YouTube actively fights automated scrapers using IP trust scores and cryptographic validation systems. If you fail these checks, YouTube throttles the video to 144p (SABR formats) or blocks the request. To counter this, ViveStream employs several highly specific architectural workarounds:

### A. The PO Token Provider Plugin (`bgutil-ytdlp-pot-provider-rs`)

To bypass the "Sign in to confirm you're not a bot" blocks, we inject a native Rust PO Token generator into `yt-dlp`.

**Why:** Google owns Chrome and Android, allowing them to strictly enforce BotGuard JS scripts to verify human users. If you do not pass a PO Token on these clients, YouTube throttles the video to 144p (SABR formats). However, Apple's ecosystem (Safari/iOS) relies on Apple's proprietary HLS (`.m3u8`) streaming protocol. Google has not yet found a reliable way to enforce strict PO Tokens on HLS streams without breaking native playback for millions of legitimate Mac users. By disguising our requests as a Safari client, we bypass the PO Token requirement entirely and access 1080p/4K streams.
- **The Trap (Nested Zips):** When downloading plugin releases from GitHub, the `.zip` files wrap the contents in a root folder (e.g., `bgutil-main/yt_dlp_plugins/`). Because `yt-dlp` strictly requires the `yt_dlp_plugins` folder to exist at the top level of the binary directory, standard extraction fails silently.
- **The Solution:** ViveStream's Rust deployment sequence manually traverses the zip archive paths in-memory, dynamically isolates the `yt_dlp_plugins` node, and extracts its exact contents directly to the root `bin` folder, ensuring the plugin is successfully discovered by `yt-dlp`.

### B. The JS Runtime Requirement (Deno)

Even with a valid PO Token, YouTube actively scrambles the final media URLs using a dynamic JavaScript signature (the `n` challenge).

- **The Trap:** If `yt-dlp` cannot decrypt this signature, it throws an `EJS` failure and drops the stream to 144p.
- **The Solution:** We download a standalone `Deno` executable directly into the `bin` directory and inject that directory into the runtime `PATH`. This allows `yt-dlp` to execute YouTube's obfuscated JavaScript and perfectly descramble the 1440p/4K URLs.

### C. Client String Restrictions & API Hot-Swapping

- **The Trap:** YouTube constantly rotates which clients require strict tokens. If we hardcode `mweb` or `android` into the backend, the app becomes instantly useless the moment YouTube blacklists that specific client.
- **The Clever Out-of-the-Box Solution:** Instead of playing a hardcoded game of whack-a-mole, we have handed the keys directly to the user. We exposed the `player_client` fallback string directly in the **Settings Menu**. If `mweb` goes down or throttles to 144p, the user can instantly hot-swap the API client to `tv_embedded,web_embedded` (which skips PO tokens) or `android_vr` without needing an app update or developer intervention. This guarantees long-term survival against YouTube's API blocks.

---

## 4. What We Are NOT Doing (And Why)

### 🚫 We are NOT using the user's browser cookies (By Default)

**Why we don't do it:** Honesty and safety. If a user logs into their personal Google account, their cookies are tied to their real-world identity. If ViveStream uses those cookies to aggressively download hundreds of videos, YouTube will permanently ban the user's actual Google Account for violating their Terms of Service. Using a stateless PO Token provider is the only ethical way forward.

### 🚫 We are NOT using headless browsers

**Why we don't do it:** Bundling a full headless engine (like Puppeteer or Playwright) into the app requires shipping Chromium. It would instantly bloat the app size by 150MB+, destroy system RAM, and ruin the lightweight architecture Tauri provides.

## 5. Maintenance Protocol

If downloads suddenly fail or return 144p video, the protocol is:

1. Swap the YouTube API Client string in the App Settings.
2. Check the `yt-dlp` GitHub Issues page for ongoing BotGuard/PO Token API changes.
3. Verify the Nightly build has been updated.
4. Check the `bgutil-ytdlp-pot-provider` repository to ensure the attestation math hasn't been blocked. Update the plugin URL in `downloader.rs` if a new version drops.
