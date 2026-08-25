# Architecture & Codebase Overview

This document provides a comprehensive overview of the architecture and directory structure for ViveStream-Next. The application is built using a decoupled client-server model wrapped inside a Tauri v2 environment.

## Directory Structure Map

### Frontend (`src/`)
The frontend is built purely with **SolidJS** to completely avoid Virtual DOM overhead, resulting in blistering fast rendering for heavy media libraries.

* **`src/App.tsx` & `src/index.tsx`**: Application entry points and router setup (`@solidjs/router`).
* **`src/store.ts`**: The central state management file. Contains reactive signals (`createSignal`) for managing global states like themes, playback queues, active video, volume, and player configuration.
* **`src/pages/`**: Contains the main route views:
  * `Home.tsx`: Dashboard and recently added media.
  * `Downloads.tsx`: Displays download history, concurrent queue statuses, and in-progress progress bars.
  * `Player.tsx`: The core media playback interface containing custom HTML5 video controls, subtitle rendering, and theater/miniplayer modes.
  * `Setup.tsx`: The zero-config wizard for checking/downloading required binaries on the first launch.
  * `Settings.tsx`: Configuration for themes, API client strings, library management, and dangerous actions (wipes).
  * `Playlists.tsx` & `Artists.tsx` & `Favourites.tsx`: Media library views reading directly from the local Rust database.
* **`src/components/`**: Reusable UI elements (e.g., `VideoCard.tsx`, `Miniplayer.tsx`, `NotificationSystem.tsx`, Modal dialogs).
* **`src/assets/`**: Static assets, banners, and default avatars.
* **Design Language**: All CSS uses a strict **Claymorphism** design pattern, relying on soft elevations, rounded pills, and dynamic shadows (detailed in `DESIGN.md`).

### Backend (`src-tauri/src/`)
The backend is written in **Rust** using Tauri v2. It acts as the local system controller, database manager, download orchestrator, and media server.

* **`main.rs`**: Entry point that fixes specific Linux compositor bugs and launches the library.
* **`lib.rs`**: The core Tauri application setup. Initializes plugins (`tauri-plugin-fs`, `tauri-plugin-shell`, `tauri-plugin-sql`, `tauri-plugin-dialog`), spawns the local HTTP server asynchronously, handles system tray setup, attaches native media controls, and registers all invoke handlers.
* **`server.rs`**: Implements a highly permissive `warp` HTTP server.
* **`db.rs`**: Initializes and manages the local SQLite database via `rusqlite`. Contains schema definitions for `Artists`, `Videos`, `Playlists`, `Playlist_Videos`, and `DownloadHistory`.
* **`downloader.rs`**: Contains the core logic for executing `yt-dlp` and `ffmpeg` processes. Manages concurrent queue slots, real-time stdout progress parsing, and the critical native WebView PO Token extraction mechanism.
* **`media_controls.rs`**: Implements the `souvlaki` crate for OS-level media integration (Windows/Linux MPRIS).
* **`system.rs`**: Helper functions to safely resolve platform-specific paths (e.g., AppData, Config Dir, Cache Dir).
* **`models.rs`**: Serde-serializable structs used for passing data between Rust and SolidJS (e.g., `VideoEntry`, `Playlist`, `DownloadHistoryEntry`).

---

## Data Flow & Streaming Pipeline

Because Tauri runs the frontend in a secure webview context (e.g., `tauri://localhost` or `http://localhost:1420`), direct file system access for large video files via standard HTML `<video>` tags is heavily restricted and poorly optimized for seeking.

### The Local HTTP Server (`warp`)
To bypass these restrictions and provide instant, seekable media streaming, the Rust backend spawns a local `warp` server on port `1422`.

1. **Server Initialization**: On startup (`lib.rs`), Tauri spawns a Tokyo async runtime task running `server.rs`.
2. **CORS & Routing**: The server is configured with a highly permissive CORS policy to accept requests from the Tauri frontend. It maps the root of the server directly to the user's base media directory.
3. **Partial Requests (Range Headers)**: `warp::fs::dir` natively handles HTTP `Range` headers. This is critical for the `Player.tsx` video element, as it allows the browser to request small chunks of a 4GB video file instead of loading the entire file into memory, enabling instant seeking and minimal memory overhead.

### State & Inter-Process Communication (IPC)
The data flow between the UI and backend relies strictly on Tauri's IPC system:

1. **Commands (Frontend -> Backend)**: The SolidJS app imports `invoke` from `@tauri-apps/api/core` to send commands (e.g., `invoke('get_video_metadata', { url })`).
2. **Events (Backend -> Frontend)**: The Rust backend uses the `Emitter` trait (`app.emit(...)`) to push real-time updates to the UI, particularly for download progress percentages and status updates from standard output streams in `downloader.rs`.
3. **Database Read/Writes**: All persistent state (video metadata, playlist order, history) is written to the SQLite database via Rust. The frontend queries these endpoints on mount (e.g., `onMount` in `Playlists.tsx`) to populate the UI.

---

## The Extraction Pipeline (Anti-Bot Architecture)

Downloading media relies on a deeply integrated combination of standard binaries and custom workarounds to defeat YouTube's anti-bot protections:

1. **Binaries**: Instead of bundling, `yt-dlp`, `FFmpeg`, and `Deno` are downloaded dynamically to the app's config directory.
2. **The PO Token Trap**: To get around strict BotGuard scripts, `downloader.rs` spawns a hidden native OS WebView navigating to a dummy YouTube embed. Rust injects a script to intercept the `fetch` API, harvests the generated Proof of Origin token, cancels the network request, kills the WebView, and feeds the token into `yt-dlp`.
3. **JS Evaluation**: The embedded `deno` binary is dynamically added to the environment `PATH` of the `Command` running `yt-dlp`, allowing it to evaluate obfuscated YouTube signatures without relying on system-installed tools.
4. **Hardware Acceleration**: The downloader explicitly passes flags to `ffmpeg` based on the operating system to prioritize hardware-accelerated video merging and transcoding (e.g., `h264_nvenc`, `h264_qsv`, `h264_vaapi`).
