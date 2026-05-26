import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const AppLogo = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 500 500"
    xmlns="http://www.w3.org/2000/svg"
    class="setup-logo"
  >
    <path
      fill="var(--primary-accent)"
      d="M83.333 0h333.334A83.333 83.333 0 0 1 500 83.333v333.334A83.333 83.333 0 0 1 416.667 500H83.333A83.333 83.333 0 0 1 0 416.667V83.333A83.333 83.333 0 0 1 83.333 0"
    />
    <path
      d="m125 125 125 250 125-250"
      stroke="var(--primary-text)"
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
      style={{
        "stroke-dasharray": "1000",
        "stroke-dashoffset": "0",
        filter: "drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fff)",
      }}
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
      if (status.ytdlp_exists && status.ffmpeg_exists) {
        // Should be caught by App.tsx lifecycle
      } else {
        addLog(
          `viveStream v0.2.0 // post-install environment check // complete`,
        );
        if (!status.ytdlp_exists) addLog(`> yt-dlp binary [miss]`);
        if (!status.ffmpeg_exists) addLog(`> ffmpeg binary [miss]`);
        addLog(`data_root: ${status.bin_folder}`);
      }
    } catch (e) {
      addLog(`>> severe error during environment check: ${e}`);
    }
  });

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
    const terminal = document.getElementById("setup-terminal");
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  };

  const startSetup = async () => {
    setLoading(true);
    addLog(`>> initialization procedure started`);
    setLogs([]);

    const unlisten = await listen<string>("setup-progress", (event) => {
      addLog(`:: ${event.payload}`);
    });

    try {
      await invoke("download_binaries");
    } catch (e) {
      addLog(`>> setup procedure failed: ${e}`);
    } finally {
      unlisten();
      setLoading(false);
    }
  };

  return (
    <div class="immersive-setup-container">
      <div class="setup-content-card">
        <div class="setup-header">
          <AppLogo />
          <h1 class="setup-title"> viveStream </h1>
        </div>

        <p class="setup-description">
          ViveStream utilizes the PolyForm Noncommercial License to keep the
          application footprint minimal and optimized directly for your specific
          GPU architecture. <br />
          To enable local playback and hardware transcoding (Intel QSV, NVIDIA
          NVENC), we must now fetch critical core dependencies (`yt-dlp` and
          `ffmpeg`) directly from trusted official sources to your local user
          account. This ensures you always have the most optimized experience.
        </p>

        <div id="setup-terminal" class="setup-terminal">
          <For each={logs()}>
            {(log) => <p class="setup-log-line">{log}</p>}
          </For>
          {loading() && (
            <p class="setup-log-line processing">
              &gt;&gt; finalization in progress...
            </p>
          )}
          {logs().length === 0 && (
            <p class="setup-log-line muted">Waiting to begin...</p>
          )}
        </div>

        <button
          class={`setup-btn ${loading() ? "loading" : ""}`}
          onClick={startSetup}
          disabled={loading()}
        >
          {loading() ? (
            <>
              <i
                class="ph ph-spinner spinIcon muted"
                style={{ "font-size": "24px" }}
              ></i>{" "}
              Processing setup Matrix
            </>
          ) : (
            <>
              <i
                class="ph-fill ph-download-simple"
                style={{ "font-size": "24px" }}
              ></i>{" "}
              start optimization procedure
            </>
          )}
        </button>
      </div>
    </div>
  );
}
