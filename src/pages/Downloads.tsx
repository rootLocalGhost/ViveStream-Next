import { onMount, onCleanup, For, Show, createSignal } from "solid-js";
import {
  downloadUrl,
  setDownloadUrl,
  downloadQuality,
  setDownloadQuality,
  tasks,
  isProcessingQueue,
  startDownloadQueue,
  updateTask,
} from "../store";

export default function Downloads() {
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

  return (
    <div class="page-wrapper" style={{ padding: "20px 30px" }}>
      <div class="command-bar" style={{ "margin-bottom": "30px" }}>
        <input
          type="text"
          placeholder="Paste YouTube URL or Playlist here..."
          value={downloadUrl()}
          onInput={(e) => setDownloadUrl(e.target.value)}
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
              {downloadQuality() === "Best"
                ? "Best Available"
                : `${downloadQuality()} (HD)`}
            </span>
            <i class="ph ph-caret-down"></i>
          </div>
          <div class="custom-select-menu">
            <For each={qualities}>
              {(q) => (
                <div
                  class={`custom-select-item ${downloadQuality() === q ? "selected" : ""}`}
                  onClick={() => {
                    setDownloadQuality(q);
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
          onClick={startDownloadQueue}
          disabled={isProcessingQueue() || !downloadUrl()}
        >
          <i
            class={
              isProcessingQueue()
                ? "ph-fill ph-spinner spinIcon"
                : "ph-fill ph-download-simple"
            }
            style={{ "font-size": "20px" }}
          ></i>
          {isProcessingQueue() ? "Fetching..." : "Download"}
        </button>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
        <For each={tasks()}>
          {(task) => (
            <div
              style={{
                background: "rgba(18, 18, 18, 0.7)",
                border:
                  task.status === "error"
                    ? "1px solid #ef233c"
                    : "1px solid var(--border-color)",
                "border-radius": "12px",
                padding: "16px",
                "box-shadow":
                  task.status === "error"
                    ? "0 0 15px rgba(239, 35, 60, 0.15)"
                    : "none",
                transition: "all 0.3s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "16px",
                }}
              >
                <img
                  src={`https://i.ytimg.com/vi/${task.id}/hqdefault.jpg`}
                  style={{
                    width: "120px",
                    "aspect-ratio": "16/9",
                    "object-fit": "cover",
                    "border-radius": "8px",
                    "flex-shrink": "0",
                  }}
                />

                <div style={{ flex: 1, "min-width": "0" }}>
                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      color: "var(--primary-text)",
                      "font-size": "15px",
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                    }}
                  >
                    {task.title}
                  </h4>
                  <p
                    style={{
                      margin: "0",
                      color: "var(--secondary-text)",
                      "font-size": "13px",
                    }}
                  >
                    {task.channel}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      "margin-top": "10px",
                    }}
                  >
                    {task.status === "pending" && (
                      <span style={{ color: "#888", "font-size": "12px" }}>
                        <i class="ph ph-clock"></i> {task.phase}
                      </span>
                    )}
                    {task.status === "downloading" && (
                      <span
                        style={{
                          color: "var(--primary-accent)",
                          "font-size": "12px",
                          "font-weight": "bold",
                        }}
                      >
                        <i class="ph ph-spinner spinIcon"></i> {task.phase}
                      </span>
                    )}
                    {task.status === "done" && (
                      <span
                        style={{
                          color: "#27c93f",
                          "font-size": "12px",
                          "font-weight": "bold",
                        }}
                      >
                        <i class="ph-fill ph-check-circle"></i> {task.phase}
                      </span>
                    )}
                    {task.status === "error" && (
                      <span
                        style={{
                          color: "#ef233c",
                          "font-size": "12px",
                          "font-weight": "bold",
                        }}
                      >
                        <i class="ph-fill ph-warning-circle"></i> {task.phase}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar Injection */}
                  <div class="progress-bar-bg">
                    <div
                      class={`progress-bar-fill ${task.status === "done" ? "done" : task.status === "error" ? "error" : task.phase.includes("Transcoding") ? "transcoding" : ""}`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    updateTask(task.id, { showLogs: !task.showLogs })
                  }
                  class={task.status === "error" ? "btn-error-glow" : ""}
                  style={{
                    background: task.showLogs
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                    border: "1px solid var(--border-color)",
                    color: "var(--primary-text)",
                    padding: "8px 12px",
                    "border-radius": "8px",
                    cursor: "pointer",
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    "font-size": "13px",
                    transition: "all 0.2s",
                  }}
                >
                  <i class="ph ph-terminal-window"></i>{" "}
                  {task.showLogs ? "Hide Logs" : "Show Logs"}
                </button>
              </div>

              <Show when={task.showLogs}>
                <div
                  class="terminal-block"
                  style={{
                    "margin-top": "16px",
                    "max-height": "150px",
                    "overflow-y": "auto",
                  }}
                >
                  <For each={task.logs}>
                    {(log) => (
                      <div style={{ "margin-bottom": "4px" }}>{log}</div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
