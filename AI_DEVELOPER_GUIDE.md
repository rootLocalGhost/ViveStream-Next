# Vivestream Revived: AI Developer & Integration Guide
**Native Whisper Synced Lyrics & Subtitles Engine**

> **Target Audience**: Any AI assistant or developer working on the **Vivestream Revived / Vivestream-Next** codebase (Tauri + Rust backend + TypeScript/React/Vue frontend).
> **Status**: Completed, bench-tested, and verified on real audio tracks up to full-length songs.

---

## 1. Executive Summary & Architecture

This repository contains **two complete implementations** of the Whisper lyrics & subtitles engine:
1. **Pure Rust Standalone Binary (`vivestream-whisper.exe`)** — **[PRIMARY / PRODUCTION TARGET]**
   - Location: `vivestream-whisper/` (compiled binary: `vivestream-whisper/target/release/vivestream-whisper.exe` or root `vivestream-whisper.exe`).
   - Purpose: Designed specifically for **Vivestream Revived**. Completely independent binary (~7.79 MB) with **zero external dependencies** (no Python, no Conda, no PyTorch, no C++ runtime).
   - **Zero App Overhead Policy**: Vivestream Revived's base installer does **not** bundle this binary or models. When the user enables "AI Lyrics & Subtitles" in Vivestream settings, Vivestream downloads `vivestream-whisper.exe` and the `base` model on-demand into `%LOCALAPPDATA%\VivestreamRevived\whisper\`.
2. **Python PyTorch + Intel Arc XPU Prototype**
   - Location: `whisper_lyrics/`, `app.py` (Gradio Web UI on port 7860).
   - Purpose: Hardware testing on Intel Arc A770 GPU (XPU) & initial algorithm prototyping.

---

## 2. Native Rust Binary: Deep Dive (`vivestream-whisper`)

### Tech Stack & Crates
- **Language**: Rust 2021 edition.
- **Inference Runtime**: Hugging Face **`candle-core`** & **`candle-transformers`** (v0.11.0). 100% pure Rust neural network execution.
- **Audio Decoder**: **`symphonia`** (v0.5.5). Pure Rust decoding of MP3, FLAC, WAV, AAC, M4A, OGG with automatic 16,000 Hz resampling.
- **Hardware Scanner**: **`sysinfo`** (v0.33.1). Inspects CPU cores, RAM, and available memory.
- **CLI & Serialization**: `clap` (derive) & `serde` / `serde_json`.

### Embedded Assets
To guarantee the binary runs anywhere without external support files, the following are embedded directly into the binary via `include_bytes!`:
1. `src/tokenizer.json` (2.48 MB): Official multilingual Whisper tokenizer (BPE).
2. `src/mel_80.bin` (64 KB): Pre-extracted 80-channel log-mel filterbank matrix (16,080 float32s).

**Resulting Executable Size**: **7.79 MB** (7,799,296 bytes).

---

## 3. CLI Commands & Output Specifications

The binary is designed to be called directly by Tauri's Rust backend (`std::process::Command` or `tauri::plugin::shell`).

### A. Hardware Scanner (`--check`)
Scans host CPU and RAM, evaluates which model tiers can run comfortably, and selects a default recommendation.

```powershell
vivestream-whisper.exe --check
```
**JSON Output (Stdout)**:
```json
{
  "status": "ready",
  "models_dir": "C:\\Users\\LEADER\\AppData\\Local\\VivestreamRevived\\whisper\\models",
  "system": {
    "cpu_brand": "AMD Ryzen 5 7500F 6-Core Processor",
    "cpu_cores": 12,
    "total_ram_gb": 15.4,
    "available_ram_gb": 6.1,
    "recommended_default_model": "base",
    "model_recommendations": [
      {
        "model": "tiny",
        "performance": "Ultra Fast (~1-2s)",
        "can_run": true,
        "min_ram_gb": 1.0,
        "recommended_ram_gb": 2.0,
        "note": "Ideal for low-end hardware, basic lyrics synchronization."
      },
      {
        "model": "base",
        "performance": "Fast & Balanced (~2-4s)",
        "can_run": true,
        "min_ram_gb": 2.0,
        "recommended_ram_gb": 4.0,
        "note": "Default recommended model for music lyrics & video subtitles."
      },
      {
        "model": "small",
        "performance": "High Accuracy (~4-8s)",
        "can_run": true,
        "min_ram_gb": 4.0,
        "recommended_ram_gb": 8.0,
        "note": "Excellent for multi-lingual songs, acoustic tracks, and complex speech."
      },
      {
        "model": "medium",
        "performance": "Near-Perfect Accuracy (~8-15s)",
        "can_run": true,
        "min_ram_gb": 6.0,
        "recommended_ram_gb": 12.0,
        "note": "Best accuracy for professional subtitle sync."
      },
      {
        "model": "large-v3",
        "performance": "Highest Quality Studio Grade (~15-25s)",
        "can_run": false,
        "min_ram_gb": 8.0,
        "recommended_ram_gb": 16.0,
        "note": "Heavy model for high-end systems."
      }
    ]
  },
  "models": [ ... ]
}
```

### B. List Installed Models & Download URLs (`--list-models`)
```powershell
vivestream-whisper.exe --list-models --models-dir <DIR>
```
**JSON Output**:
```json
{
  "models_dir": "models",
  "models": [
    {
      "name": "tiny",
      "expected_size_mb": 75,
      "download_url": "https://huggingface.co/openai/whisper-tiny/resolve/main/model.safetensors",
      "installed": true,
      "path": "models\\tiny.safetensors"
    },
    {
      "name": "base",
      "expected_size_mb": 140,
      "download_url": "https://huggingface.co/openai/whisper-base/resolve/main/model.safetensors",
      "installed": true,
      "path": "models\\base.safetensors"
    },
    {
      "name": "small",
      "expected_size_mb": 460,
      "download_url": "https://huggingface.co/openai/whisper-small/resolve/main/model.safetensors",
      "installed": true,
      "path": "models\\small.safetensors"
    }
  ]
}
```

### C. Transcribing Full Audio / Music Tracks
```powershell
vivestream-whisper.exe "path/to/song.mp3" --model base --models-dir "path/to/models" -f all -o "path/to/output_dir"
```
Flags:
- `AUDIO_PATH`: Path to input file (MP3, FLAC, WAV, AAC, M4A, OGG).
- `-m, --model <MODEL>`: `tiny`, `base`, `small`, `medium`, or `large-v3` (default: `base`).
- `--models-dir <DIR>`: Custom folder storing `.safetensors` files. Defaults to `%LOCALAPPDATA%\VivestreamRevived\whisper\models` or `./models/`.
- `-f, --format <FORMAT>`: Comma-separated: `lrc`, `elrc`, `srt`, `vtt`, `json`, or `all`.
- `-o, --output-dir <DIR>`: Destination directory for files.
- `--title <STR>` & `--artist <STR>`: Optional metadata inserted into LRC headers.
- `--json`: Outputs full structured JSON to `stdout` (ideal for Tauri child process capture).

---

## 4. Key Architectural Rule: 30-Second Mel Slicing

> [!IMPORTANT]
> **Why Whisper requires 30-second windowing:**
> Whisper's Transformer encoder has a fixed positional embedding of **1,500 positions** (derived from 3,000 mel frames downsampled by 2 via conv layers with stride 2).
> Passing raw audio longer than 30.00 seconds (> 480,000 PCM samples) directly into the encoder will trigger:
> `Encoder forward pass error: narrow invalid args start + len > dim_len: [1500, 512]`
>
> In `vivestream-whisper/src/engine.rs`:
> The engine computes the full mel spectrogram once across the audio, and then slices through it using `mel_tensor.narrow(2, seek, segment_size)` where `segment_size <= 3000` (`N_FRAMES`), incrementing `seek += segment_size`. This allows arbitrary-length audio tracks to be processed cleanly.

---

## 5. Output Lyric Formats Explained

### 1. Standard Synchronized LRC (`.lrc`)
Line-by-line synchronized lyrics for standard music players:
```lrc
[by:Vivestream-Revived-Native]
[00:00.00] [ Music ]
[00:30.00] Swing, swing, swing the spinning step. You wear those shoes and I will wear that dress.
[01:00.00] Kiss me, kiss me down by the broken treehouse, swing me upon its hanging tire...
```

### 2. Enhanced Word-by-Word Karaoke LRC (`.enhanced.lrc`)
Word-level synchronized timestamps for karaoke singing animations:
```lrc
[by:Vivestream-Revived-Karaoke]
[01:00.00] <01:00.00> ♪ <01:00.50> Kiss <01:01.02> me <01:01.53> ♪ <01:02.03> ♪ <01:02.53> Kiss <01:03.04> me <01:03.56> ♪ <01:04.06> ♪ <01:04.57> Down <01:05.07> by <01:05.59> the <01:06.09> broken <01:06.60> tree <01:07.12> ♪
```

### 3. Structured JSON (`--json` or `.json`)
Direct payload for Tauri IPC:
```json
{
  "success": true,
  "duration": 196.73,
  "language": "en",
  "text": "...",
  "lrc": "...",
  "enhanced_lrc": "...",
  "srt": "...",
  "segments": [
    {
      "id": 0,
      "start": 30.0,
      "end": 60.0,
      "text": "Swing, swing, swing the spinning step...",
      "words": [
        { "word": "Swing", "start": 30.0, "end": 30.6, "probability": 0.95 },
        { "word": "swing", "start": 30.6, "end": 31.2, "probability": 0.95 }
      ]
    }
  ]
}
```

---

## 6. How to Integrate into Vivestream Revived (Tauri App)

### Directory Layout in Vivestream User's System
```
%LOCALAPPDATA%\VivestreamRevived\whisper\
├── vivestream-whisper.exe       # Downloaded on-demand (~7.8 MB)
└── models\
    ├── base.safetensors         # Downloaded on-demand (~140 MB)
    └── small.safetensors        # Optional high-tier model (~922 MB)
```

### Step 1: Rust Backend Command (`src-tauri/src/whisper.rs`)
In your Tauri project's `src-tauri/src/whisper.rs`:
```rust
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct WhisperCheck {
    pub binary_installed: bool,
    pub model_installed: bool,
    pub system_scan: Option<serde_json::Value>,
}

pub fn get_whisper_root(app: &AppHandle) -> PathBuf {
    let mut p = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    p.push("whisper");
    std::fs::create_dir_all(&p).ok();
    p
}

#[tauri::command]
pub async fn check_whisper(app: AppHandle) -> Result<WhisperCheck, String> {
    let root = get_whisper_root(&app);
    let bin = root.join("vivestream-whisper.exe");
    let model = root.join("models").join("base.safetensors");

    let binary_installed = bin.is_file();
    let model_installed = model.is_file();

    let mut system_scan = None;
    if binary_installed {
        if let Ok(out) = Command::new(&bin).arg("--check").output() {
            if out.status.success() {
                system_scan = serde_json::from_slice(&out.stdout).ok();
            }
        }
    }

    Ok(WhisperCheck {
        binary_installed,
        model_installed,
        system_scan,
    })
}

#[tauri::command]
pub async fn generate_track_lyrics(
    app: AppHandle,
    audio_path: String,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    let root = get_whisper_root(&app);
    let bin = root.join("vivestream-whisper.exe");
    let models_dir = root.join("models");

    let model_name = model.unwrap_or_else(|| "base".to_string());

    let output = Command::new(&bin)
        .arg(&audio_path)
        .arg("--model")
        .arg(&model_name)
        .arg("--models-dir")
        .arg(&models_dir)
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to spawn vivestream-whisper: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|e| format!("JSON parse error: {}", e))
}
```

### Step 2: TypeScript Frontend Hook (`useWhisperLyrics.ts`)
```typescript
import { invoke } from '@tauri-apps/api/core';

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

export interface LyricsResponse {
  success: boolean;
  duration: number;
  language: string;
  lrc: string;
  enhanced_lrc: string;
  srt: string;
  segments: WhisperSegment[];
}

export async function transcribeSong(audioPath: string, model = 'base'): Promise<LyricsResponse> {
  return await invoke('generate_track_lyrics', { audioPath, model });
}
```

### Step 3: Karaoke Real-Time Highlighter (TypeScript / React)
```typescript
// Synchronize active karaoke word to audio currentTime:
function getActiveWord(segments: WhisperSegment[], currentTime: number): WhisperWord | null {
  for (const seg of segments) {
    if (currentTime >= seg.start && currentTime <= seg.end) {
      for (const w of seg.words) {
        if (currentTime >= w.start && currentTime <= w.end) {
          return w;
        }
      }
    }
  }
  return null;
}
```

---

## 7. Building Releases & CI/CD

### 1-Click Local Build Script
Located at [`vivestream-whisper/build_release.bat`](file:///c:/Users/LEADER/Desktop/whisper/vivestream-whisper/build_release.bat).
Double-clicking or running this compiles `target/release/vivestream-whisper.exe` using `cargo build --release -j 2`.

### GitHub Actions Workflow
Located at [`.github/workflows/release-whisper.yml`](file:///c:/Users/LEADER/Desktop/whisper/.github/workflows/release-whisper.yml).
Pushing a git tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) automatically compiles:
- `vivestream-whisper-windows-x64.exe` (Windows)
- `vivestream-whisper-linux-x64` (Linux)
- `vivestream-whisper-macos-x64` / `vivestream-whisper-macos-arm64` (macOS)
and attaches them to a new GitHub Release. Vivestream Revived can download the executable directly from the GitHub Release asset URL!

---

## 8. Summary of Files in this Repository

| Path | Description |
|---|---|
| `vivestream-whisper/` | **Pure Rust crate** with Candle & Symphonia |
| `vivestream-whisper/src/main.rs` | CLI parsing, hardware check, model listing, JSON dispatch |
| `vivestream-whisper/src/engine.rs` | 30s sliding-window inference, mel narrow, token decoding |
| `vivestream-whisper/src/audio.rs` | Symphonia decoder + resampler (16kHz float32 mono) |
| `vivestream-whisper/src/system.rs` | RAM & CPU core scanner, tier recommendations |
| `vivestream-whisper/src/models.rs` | SafeTensors file resolver & Hugging Face download URLs |
| `vivestream-whisper/src/exporters.rs` | Standard LRC, Enhanced Karaoke LRC, SRT, VTT, JSON |
| `vivestream-whisper/src/tokenizer.json` | Embedded official Whisper multilingual tokenizer |
| `vivestream-whisper/src/mel_80.bin` | Embedded 80-channel log-mel filterbank matrix |
| `models/` | Local model weights (`tiny.safetensors`, `base.safetensors`, `small.safetensors`) |
| `.github/workflows/release-whisper.yml` | Multi-platform GitHub Actions release builder |
| `tauri_integration_guide.md` | In-depth Tauri commands and TypeScript guide |
| `app.py` | Gradio web studio (Python/XPU prototype) |
| `whisper_lyrics/` | Python lyrics engine module (PyTorch XPU prototype) |
