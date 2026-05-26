import { createSignal, onMount, onCleanup, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export default function Downloads() {
  const [url, setUrl] = createSignal("");
  const [quality, setQuality] = createSignal("1080p");
  const [progress, setProgress] = createSignal("");
  const [downloading, setDownloading] = createSignal(false);
  const [dropdownOpen, setDropdownOpen] = createSignal(false);

  let dropdownRef: HTMLDivElement | undefined;

  const qualities = ["720p", "1080p", "1440p", "4K", "Best"];

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
      document.removeEventListener("mousedown", handleClickOutside),
    );
  });

  const startDownload = async () => {
    if (!url()) return;
    setDownloading(true);
    setProgress("Fetching video metadata...");

    try {
      const metadata = await invoke("get_video_metadata", { url: url() });
      setProgress(`Starting ${quality()} download with Intel QSV...`);

      const unlisten = await listen<string>("download-progress", (event) => {
        setProgress(event.payload);
      });

      await invoke("download_video", {
        url: url(),
        metadata,
        quality: quality(),
      });

      setProgress("Download and hardware transcoding complete!");
      unlisten();
    } catch (e) {
      setProgress(`Error: ${e}`);
    } finally {
      setDownloading(false);
      setUrl("");
    }
  };

  return (
    <div class="page-wrapper">
      <div class="command-bar">
        <input
          type="text"
          placeholder="Paste YouTube URL here..."
          value={url()}
          onInput={(e) => setUrl(e.target.value)}
          class="command-input"
        />

        <div
          class={`custom-select-wrapper ${dropdownOpen() ? "open" : ""}`}
          ref={dropdownRef}
        >
          <div
            class="custom-select-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen())}
          >
            <span>
              {quality() === "Best" ? "Best Available" : `${quality()} (HD)`}
            </span>
            <i class="ph ph-caret-down"></i>
          </div>
          <div class="custom-select-menu">
            <For each={qualities}>
              {(q) => (
                <div
                  class={`custom-select-item ${quality() === q ? "selected" : ""}`}
                  onClick={() => {
                    setQuality(q);
                    setDropdownOpen(false);
                  }}
                >
                  {q === "Best" ? "Best Available" : `${q} (HD)`}
                </div>
              )}
            </For>
          </div>
        </div>

        <button
          class="command-btn"
          onClick={startDownload}
          disabled={downloading() || !url()}
        >
          <i
            class={
              downloading()
                ? "ph-fill ph-spinner spinIcon"
                : "ph-fill ph-download-simple"
            }
            style={{ "font-size": "20px" }}
          ></i>
          {downloading() ? "Processing" : "Download"}
        </button>
      </div>

      <div class="terminal-block">
        {progress() || (
          <span style={{ color: "var(--secondary-text)" }}>
            Awaiting input stream...
          </span>
        )}
      </div>
    </div>
  );
}
