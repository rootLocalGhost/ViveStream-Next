import { onMount, onCleanup, For, Show, createSignal } from "solid-js";
import {
  downloadUrl,
  setDownloadUrl,
  downloadQuality,
  updateDownloadQuality,
  tasks,
  isProcessingQueue,
  startDownloadQueue,
  updateTask,
  downloadType,
  updateDownloadType,
  dlSubtitles,
  toggleDlSubtitles,
  liveFromStart,
  toggleLiveFromStart,
} from "../store";

export default function Downloads() {
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"Active Queue" | "History">(
    "Active Queue",
  );

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

  const clearHistory = () => {
    // Implement history clear if needed in future
  };

  return (
    <div class="page-wrapper">
      <div class="download-input-group">
        <i
          class="ph ph-link"
          style={{ "font-size": "20px", color: "var(--secondary-text)" }}
        ></i>
        <input
          type="text"
          placeholder="Paste video or playlist URL..."
          value={downloadUrl()}
          onInput={(e) => setDownloadUrl(e.target.value)}
        />
        <div class="segmented-control">
          <button
            class={`segmented-btn ${downloadType() === "Video" ? "active" : ""}`}
            onClick={() => updateDownloadType("Video")}
          >
            Video
          </button>
          <button
            class={`segmented-btn ${downloadType() === "Audio" ? "active" : ""}`}
            onClick={() => updateDownloadType("Audio")}
          >
            Audio
          </button>
        </div>
        <button
          class="dl-action-btn"
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
        </button>
      </div>

      <div class="dl-options-grid">
        <div class="dl-option-card">
          <span class="dl-option-title">Quality</span>
          <div
            class={`custom-select-wrapper ${dropdownOpen() ? "open" : ""}`}
            ref={dropdownRef}
            style={{ width: "100%" }}
          >
            <div
              class="custom-select-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen())}
            >
              <span>
                {downloadQuality() === "Best"
                  ? "Best Available"
                  : `${downloadQuality()}`}
              </span>
              <i class="ph ph-caret-down"></i>
            </div>
            <div class="custom-select-menu">
              <For each={qualities}>
                {(q) => (
                  <div
                    class={`custom-select-item ${downloadQuality() === q ? "selected" : ""}`}
                    onClick={() => {
                      updateDownloadQuality(q);
                      setDropdownOpen(false);
                    }}
                  >
                    {q === "Best" ? "Best Available" : `${q}`}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div
          class="dl-option-card flex-row-between"
          style={{ "flex-direction": "row" }}
        >
          <span class="dl-option-title">Subtitles</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={dlSubtitles()}
              onChange={(e) => toggleDlSubtitles(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        <div
          class="dl-option-card flex-row-between"
          style={{ "flex-direction": "row" }}
        >
          <span class="dl-option-title">Live from start</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={liveFromStart()}
              onChange={(e) => toggleLiveFromStart(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="tabs-header">
        <div style={{ display: "flex", gap: "16px" }}>
          <button
            class={`tab-btn ${activeTab() === "Active Queue" ? "active" : ""}`}
            onClick={() => setActiveTab("Active Queue")}
          >
            Active Queue
          </button>
          <button
            class={`tab-btn ${activeTab() === "History" ? "active" : ""}`}
            onClick={() => setActiveTab("History")}
          >
            History
          </button>
        </div>
        <button
          class="control-btn"
          onClick={clearHistory}
          style={{
            position: "absolute",
            right: "0",
            color: "var(--secondary-text)",
          }}
        >
          <i class="ph ph-trash"></i>
        </button>
      </div>

      <Show when={tasks().length === 0}>
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            "margin-top": "60px",
            opacity: 0.5,
            gap: "16px",
          }}
        >
          <i
            class="ph ph-stack"
            style={{ "font-size": "48px", color: "var(--secondary-text)" }}
          ></i>
          <span
            style={{ color: "var(--secondary-text)", "font-weight": "600" }}
          >
            Queue is empty
          </span>
        </div>
      </Show>

      <Show when={tasks().length > 0}>
        <div class="flex-col-gap" style={{ gap: "16px" }}>
          <For each={tasks()}>
            {(task) => (
              <div
                style={{
                  background: "var(--bg-card)",
                  border:
                    task.status === "error"
                      ? "1px solid #ef233c"
                      : "1px solid var(--border-color)",
                  "border-radius": "12px",
                  padding: "16px",
                  "box-shadow":
                    task.status === "error"
                      ? "0 0 15px rgba(239, 35, 60, 0.15)"
                      : "var(--shadow-card)",
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
                        <span
                          style={{
                            color: "var(--secondary-text)",
                            "font-size": "12px",
                          }}
                        >
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
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        background: "var(--divider)",
                        "border-radius": "3px",
                        "margin-top": "12px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        class={`progress-fill ${task.status === "done" ? "done" : task.status === "error" ? "error" : task.phase.includes("Transcoding") ? "transcoding" : ""}`}
                        style={{
                          width: `${task.progress}%`,
                          background:
                            task.status === "done"
                              ? "#27c93f"
                              : task.status === "error"
                                ? "#ef233c"
                                : "var(--primary-accent)",
                        }}
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
                        ? "var(--tertiary-background)"
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
      </Show>
    </div>
  );
}
