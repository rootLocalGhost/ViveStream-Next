import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const AnimatedLogo = () => (
  <svg
    width="72"
    height="72"
    viewBox="0 0 500 500"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#ef233c"
      d="M83.333 0h333.334A83.333 83.333 0 0 1 500 83.333v333.334A83.333 83.333 0 0 1 416.667 500H83.333A83.333 83.333 0 0 1 0 416.667V83.333A83.333 83.333 0 0 1 83.333 0"
    />

    <path
      d="m125 125 125 250 125-250"
      stroke="#ffffff"
      stroke-width="25"
      fill="none"
      stroke-linecap="round"
    />

    <path
      d="M375 125c-241.667 62.5-270.833-41.667-225 0 8.333 41.667 16.667-20.833 25 0s16.667-62.5 25 0 16.667-33.333 25 0 16.667-8.333 25 0c8.333 50 16.667-58.333 25 0 8.333 20.833 16.667-41.667 25 0 8.333 62.5 16.667-20.833 25 0 8.333 41.667 16.667-50 25 0 8.333 25 16.667-33.333 25 0"
      stroke="#fff"
      stroke-width="5.208"
      fill="none"
      stroke-linecap="round"
      style="stroke-dasharray:1000; stroke-dashoffset:0; filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fff);"
    />
  </svg>
);

export default function Setup() {
  const [loading, setLoading] = createSignal(false);
  const [logs, setLogs] = createSignal<string[]>([]);

  onMount(async () => {
    try {
      const status = await invoke<{
        ytdlp_exists: boolean;
        ffmpeg_exists: boolean;
        bin_folder: string;
      }>("check_binaries");
      if (!status.ytdlp_exists || !status.ffmpeg_exists) {
        addLog(`ViveStream v0.3.0 // Environment Check`);
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

  const startSetup = async () => {
    setLoading(true);
    setLogs([]);
    addLog(`[SYSTEM] Initializing deployment sequence...`);

    const unlisten = await listen<string>("setup-progress", (event) => {
      addLog(`> ${event.payload}`);
    });

    try {
      await invoke("download_binaries");
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
        <div class="setup-header">
          <AnimatedLogo />
          <h1 class="setup-title">VIVESTREAM</h1>
          <p class="setup-description">
            To enable local hardware transcoding (Intel QSV / NVIDIA NVENC),
            ViveStream requires specific core media engines. We fetch these
            directly from their official, secure repositories to your local user
            account.
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
                  class={`setup-log-line ${log.includes("[ERROR]") ? "r" : ""}`}
                >
                  {log}
                </p>
              )}
            </For>
            {loading() && (
              <p class="setup-log-line processing">&gt; Working...</p>
            )}
            {logs().length === 0 && (
              <p class="setup-log-line muted">Awaiting user authorization...</p>
            )}
          </div>
        </div>

        <button
          class={`setup-btn ${loading() ? "loading" : ""}`}
          onClick={startSetup}
          disabled={loading()}
        >
          {loading() ? (
            <>
              <i
                class="ph ph-spinner spinIcon"
                style={{ "font-size": "22px" }}
              ></i>{" "}
              DEPLOYING ENGINES
            </>
          ) : (
            <>
              <i
                class="ph-fill ph-download-simple"
                style={{ "font-size": "22px" }}
              ></i>{" "}
              INITIALIZE DEPLOYMENT
            </>
          )}
        </button>
      </div>
    </div>
  );
}
