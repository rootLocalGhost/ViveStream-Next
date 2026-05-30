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
import "./Downloads.css";

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
    <div class="page-wrapper downloads-page">
      <div class="download-input-group">
        <i class="ph ph-link"></i>
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
          ></i>
        </button>
      </div>

      <div class="dl-options-grid">
        <div class="dl-option-card">
          <span class="dl-option-title">Quality</span>
          <div
            class={`custom-select-wrapper full-width ${dropdownOpen() ? "open" : ""}`}
            ref={dropdownRef}
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

        <div class="dl-option-card flex-row-between">
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

        <div class="dl-option-card flex-row-between">
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
        <div class="tabs-controls">
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
          class="control-btn clear-history-btn"
          onClick={clearHistory}
        >
          <i class="ph ph-trash"></i>
        </button>
      </div>

      <Show when={tasks().length === 0}>
        <div class="empty-queue-state">
          <i class="ph ph-stack empty-icon"></i>
          <span class="empty-message">Queue is empty</span>
        </div>
      </Show>

      <Show when={tasks().length > 0}>
        <div class="flex-col-gap download-task-list">
          <For each={tasks()}>
            {(task) => (
              <div class={`download-task-card ${task.status === "error" ? "error" : ""}`}>
                <div class="download-task-row">
                  <img
                    src={`https://i.ytimg.com/vi/${task.id}/hqdefault.jpg`}
                    class="task-thumbnail"
                  />
                  <div class="task-meta">
                    <h4 class="task-title">
                      {task.title}
                    </h4>
                    <p class="task-channel">
                      {task.channel}
                    </p>
                    <div class="task-stats">
                      {task.status === "pending" && (
                        <span class="task-state pending">
                          <i class="ph ph-clock"></i> {task.phase}
                        </span>
                      )}
                      {task.status === "downloading" && (
                        <span class="task-state downloading">
                          <i class="ph ph-spinner spinIcon"></i> {task.phase}
                        </span>
                      )}
                      {task.status === "done" && (
                        <span class="task-state done">
                          <i class="ph-fill ph-check-circle"></i> {task.phase}
                        </span>
                      )}
                      {task.status === "error" && (
                        <span class="task-state error">
                          <i class="ph-fill ph-warning-circle"></i> {task.phase}
                        </span>
                      )}
                    </div>
                    <div class="task-progress">
                      <div
                        class={`progress-fill ${task.status === "done" ? "done" : task.status === "error" ? "error" : task.phase.includes("Transcoding") ? "transcoding" : ""}`}
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      updateTask(task.id, { showLogs: !task.showLogs })
                    }
                    class={`task-toggle-btn ${task.showLogs ? "active" : ""} ${task.status === "error" ? "btn-error-glow" : ""}`}
                  >
                    <i class="ph ph-terminal-window"></i>{" "}
                    {task.showLogs ? "Hide Logs" : "Show Logs"}
                  </button>
                </div>
                <Show when={task.showLogs}>
                  <div class="terminal-block">
                    <For each={task.logs}>
                      {(log) => (
                        <div class="task-log-line">{log}</div>
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
