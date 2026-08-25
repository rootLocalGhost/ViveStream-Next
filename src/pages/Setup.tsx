import { createSignal, onMount, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setForceSetup } from "../store";
import "./Setup.css";

const AnimatedLogo = () => (
  <svg
    width="84"
    height="84"
    viewBox="0 0 500 500"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <style>
        {`
          @keyframes drawWave {
            0% { stroke-dashoffset: 2000; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 4px var(--primary-accent)) drop-shadow(0 0 8px var(--primary-accent)); }
            50% { opacity: 1; filter: drop-shadow(0 0 8px var(--primary-accent)) drop-shadow(0 0 16px var(--primary-accent)); }
          }
          .animated-wave {
            stroke-dasharray: 2000;
            stroke-dashoffset: 2000;
            animation: drawWave 10s forwards, pulseGlow 5s ease-in-out infinite;
          }
        `}
      </style>
      <filter id="clayGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow
          dx="0"
          dy="8"
          stdDeviation="12"
          flood-color="rgba(0,0,0,0.2)"
        />
        <feDropShadow
          dx="0"
          dy="-4"
          stdDeviation="8"
          flood-color="rgba(255,255,255,0.1)"
        />
      </filter>
    </defs>
    <path
      fill="var(--primary-accent)"
      filter="url(#clayGlow)"
      d="M83.333 0h333.334A83.333 83.333 0 0 1 500 83.333v333.334A83.333 83.333 0 0 1 416.667 500H83.333A83.333 83.333 0 0 1 0 416.667V83.333A83.333 83.333 0 0 1 83.333 0"
    />
    <path
      d="M95 125 L250 385 L405 125"
      stroke="#f1f1f1"
      stroke-width="30"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="animated-wave"
      d="M100 125 Q110 125 118 85 Q126 45 134 125 Q142 175 150 125 Q158 75 166 125 Q174 25 182 125 Q190 215 198 125 Q206 55 214 125 Q222 195 230 125 Q238 35 246 125 Q254 235 262 125 Q270 45 278 125 Q286 205 294 125 Q302 65 310 125 Q318 175 326 125 Q334 85 342 125 Q350 225 358 125 Q366 55 374 125 Q382 165 390 125 Q398 105 405 125"
      stroke="#ffffff"
      stroke-width="8"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

export default function Setup(props: { onComplete?: () => void }) {
  const [loading, setLoading] = createSignal(false);
  const [isCompleted, setIsCompleted] = createSignal(false);
  const [showLogs, setShowLogs] = createSignal(false);
  const [logs, setLogs] = createSignal<string[]>([]);
  const [downloadProgress, setDownloadProgress] = createSignal<number>(0);

  onMount(async () => {
    try {
      const status = await invoke<{
        ytdlp_exists: boolean;
        ffmpeg_exists: boolean;
        bin_folder: string;
      }>("check_binaries");
      if (!status.ytdlp_exists || !status.ffmpeg_exists) {
        addLog(`ViveStream v1.8.7 // Environment Check`);
        if (!status.ytdlp_exists)
          addLog(`[MISSING] yt-dlp core engine not found.`);
        if (!status.ffmpeg_exists)
          addLog(`[MISSING] FFmpeg hardware transcoder not found.`);
        addLog(`Target Data Path: ${status.bin_folder}`);
        addLog(`Ready to initiate secure deployment.`);
      }
    } catch (e) {
      addLog(`[ERROR] System check failed: ${e}`);
    }
  });

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
    const terminal = document.getElementById("setup-terminal");
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  };

  const handleLaunch = () => {
    setForceSetup(false);
    if (props.onComplete) {
      props.onComplete();
    }
  };

  const startSetup = async () => {
    setLoading(true);
    setLogs([]);
    setDownloadProgress(0);
    addLog(`[SYSTEM] Initializing deployment sequence...`);

    const unlisten = await listen<string>("setup-progress", (event) => {
      const payload = event.payload;

      if (payload === "[COMPLETE]" || payload === "[RESTART]") {
        addLog("> Deployment successful. All core engines integrated.");
        setDownloadProgress(100);
        setIsCompleted(true);
        return;
      }

      if (payload.startsWith("[PROGRESS]")) {
        const value = parseFloat(payload.replace("[PROGRESS]", "").trim());
        if (!isNaN(value)) setDownloadProgress(value);
      } else {
        addLog(`> ${payload}`);
      }
    });

    try {
      await invoke("download_binaries");
      setIsCompleted(true);
    } catch (e) {
      addLog(`[CRITICAL FAILURE] Deployment aborted: ${e}`);
    } finally {
      unlisten();
      setLoading(false);
    }
  };

  return (
    <div class="immersive-setup-container">
      <div class="setup-content-card">
        <Show
          when={isCompleted()}
          fallback={
            <>
              <div class="setup-header">
                <AnimatedLogo />
                <h1 class="setup-title">VIVESTREAM</h1>
                <p class="setup-description">
                  To enable local hardware transcoding (Intel QSV / NVIDIA
                  NVENC) and stream extraction, ViveStream requires core media
                  engines fetched securely from official repositories.
                </p>
              </div>
              <div class="setup-terminal-wrapper">
                <div class="terminal-header">
                  <div class="term-dot r"></div>
                  <div class="term-dot y"></div>
                  <div class="term-dot g"></div>
                </div>
                <div id="setup-terminal" class="setup-terminal">
                  <For each={logs()}>
                    {(log) => (
                      <p
                        class={`setup-log-line ${log.includes("[ERROR]") || log.includes("[CRITICAL") || log.includes("[MISSING]") ? "r" : ""}`}
                      >
                        {log}
                      </p>
                    )}
                  </For>
                  {loading() && downloadProgress() === 0 && (
                    <p class="setup-log-line processing">&gt; Working...</p>
                  )}
                  {logs().length === 0 && (
                    <p class="setup-log-line muted">
                      Awaiting user authorization...
                    </p>
                  )}
                </div>
              </div>
              <button
                class={`setup-btn ${loading() ? "loading" : ""}`}
                onClick={startSetup}
                disabled={loading()}
                style={
                  loading() && downloadProgress() > 0
                    ? {
                        background: `linear-gradient(90deg, var(--primary-accent) ${downloadProgress()}%, var(--tertiary-background) ${downloadProgress()}%)`,
                      }
                    : {}
                }
              >
                {loading() ? (
                  <>
                    <i class="ph ph-spinner spinIcon"></i>
                    {downloadProgress() > 0 && downloadProgress() < 100
                      ? `DOWNLOADING... ${downloadProgress().toFixed(1)}%`
                      : "DEPLOYING ENGINES"}
                  </>
                ) : (
                  <>
                    <i class="ph-fill ph-download-simple"></i> INITIALIZE
                    DEPLOYMENT
                  </>
                )}
              </button>
            </>
          }
        >
          {/* Custom Styled Completion Screen */}
          <div class="setup-complete-container">
            <div class="setup-success-badge">
              <div class="setup-success-glow"></div>
              <i class="ph-fill ph-check-circle setup-success-icon"></i>
            </div>

            <div class="setup-header">
              <h1 class="setup-title setup-complete-title">SETUP COMPLETE</h1>
              <p class="setup-description">
                All media engines and hardware acceleration pipelines are fully
                configured and verified.
              </p>
            </div>

            <div class="setup-status-grid">
              <div class="setup-status-item">
                <div class="setup-status-icon-box ready">
                  <i class="ph-fill ph-check"></i>
                </div>
                <div class="setup-status-text">
                  <span class="setup-status-name">yt-dlp Core Engine</span>
                  <span class="setup-status-desc">Nightly Build Verified</span>
                </div>
              </div>

              <div class="setup-status-item">
                <div class="setup-status-icon-box ready">
                  <i class="ph-fill ph-check"></i>
                </div>
                <div class="setup-status-text">
                  <span class="setup-status-name">Deno JS Runtime</span>
                  <span class="setup-status-desc">
                    n-Challenge Decryption Active
                  </span>
                </div>
              </div>

              <div class="setup-status-item">
                <div class="setup-status-icon-box ready">
                  <i class="ph-fill ph-check"></i>
                </div>
                <div class="setup-status-text">
                  <span class="setup-status-name">FFmpeg Transcoder</span>
                  <span class="setup-status-desc">
                    Intel QSV / NVIDIA NVENC Enabled
                  </span>
                </div>
              </div>

              <div class="setup-status-item">
                <div class="setup-status-icon-box ready">
                  <i class="ph-fill ph-check"></i>
                </div>
                <div class="setup-status-text">
                  <span class="setup-status-name">Local Library</span>
                  <span class="setup-status-desc">
                    High-Performance Database Ready
                  </span>
                </div>
              </div>
            </div>

            <button class="setup-btn setup-launch-btn" onClick={handleLaunch}>
              <i class="ph-fill ph-rocket-launch"></i> LAUNCH VIVESTREAM
            </button>

            <div
              class="setup-log-toggle"
              onClick={() => setShowLogs(!showLogs())}
            >
              <i class={`ph ph-caret-${showLogs() ? "up" : "down"}`}></i>
              <span>
                {showLogs() ? "Hide Deployment Logs" : "View Deployment Logs"}
              </span>
            </div>

            <Show when={showLogs()}>
              <div class="setup-terminal-wrapper setup-terminal-compact">
                <div class="setup-terminal">
                  <For each={logs()}>
                    {(log) => <p class="setup-log-line">{log}</p>}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
