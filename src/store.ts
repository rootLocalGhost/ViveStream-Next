import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const storedAnimPref = isBrowser
  ? window.localStorage.getItem("useAnimatedIcons")
  : null;
const initialAnimState =
  storedAnimPref !== null ? storedAnimPref === "true" : true;

const storedHoverPref = isBrowser
  ? window.localStorage.getItem("sidebarHoverMode")
  : null;
const initialHoverState =
  storedHoverPref !== null ? storedHoverPref === "true" : true;

const storedTheme = isBrowser ? window.localStorage.getItem("appTheme") : null;
const initialTheme = storedTheme === "light" ? "light" : "dark";

const storedPalette = isBrowser
  ? window.localStorage.getItem("appPalette")
  : null;
const initialPalette = storedPalette || "default";

if (isBrowser) {
  document.documentElement.setAttribute("data-theme", initialTheme);
  document.documentElement.setAttribute("data-palette", initialPalette);
}

export const [useAnimatedIcons, setUseAnimatedIcons] =
  createSignal(initialAnimState);
export const toggleAnimatedIcons = (val: boolean) => {
  setUseAnimatedIcons(val);
  if (isBrowser)
    window.localStorage.setItem("useAnimatedIcons", val.toString());
};

export const [sidebarHoverMode, setSidebarHoverMode] =
  createSignal(initialHoverState);
export const toggleSidebarHoverMode = (val: boolean) => {
  setSidebarHoverMode(val);
  if (isBrowser)
    window.localStorage.setItem("sidebarHoverMode", val.toString());
};

export const [appTheme, setAppTheme] = createSignal(initialTheme);
export const toggleAppTheme = (theme: "light" | "dark") => {
  setAppTheme(theme);
  if (isBrowser) {
    window.localStorage.setItem("appTheme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    // Force default palette if switching to dark mode, as sunset is light-only
    if (theme === "dark" && appPalette() !== "default") {
      toggleAppPalette("default");
    }
  }
};

export const [appPalette, setAppPalette] = createSignal(initialPalette);
export const toggleAppPalette = (palette: string) => {
  setAppPalette(palette);
  if (isBrowser) {
    window.localStorage.setItem("appPalette", palette);
    document.documentElement.setAttribute("data-palette", palette);
  }
};

export interface VideoEntry {
  id: string;
  title: string;
  channel: string;
  video_path: string;
  thumbnail_path: string;
}

export interface DownloadTask {
  id: string;
  title: string;
  channel: string;
  metadata: VideoEntry;
  status: "pending" | "downloading" | "done" | "error";
  logs: string[];
  showLogs: boolean;
  progress: number;
  phase: string;
}

export const [downloadUrl, setDownloadUrl] = createSignal("");
export const [downloadQuality, setDownloadQuality] = createSignal("1440p");
export const [tasks, setTasks] = createSignal<DownloadTask[]>([]);
export const [isProcessingQueue, setIsProcessingQueue] = createSignal(false);
export const [homeVideos, setHomeVideos] = createSignal<VideoEntry[]>([]);

export const updateTask = (id: string, updates: Partial<DownloadTask>) => {
  setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
};

export const startDownloadQueue = async () => {
  const targetUrl = downloadUrl();
  if (!targetUrl) return;

  setIsProcessingQueue(true);
  setDownloadUrl("");

  try {
    const metadataList = await invoke<VideoEntry[]>("get_video_metadata", {
      url: targetUrl,
    });
    const newTasks: DownloadTask[] = metadataList.map((meta) => ({
      id: meta.id,
      title: meta.title,
      channel: meta.channel,
      metadata: meta,
      status: "pending",
      logs: [],
      showLogs: false,
      progress: 0,
      phase: "Queued",
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    for (const task of newTasks) {
      updateTask(task.id, {
        status: "downloading",
        phase: "Initializing Engine...",
        logs: ["Initializing engine..."],
      });

      const unlisten = await listen<string>(
        `download-progress-${task.id}`,
        (event) => {
          const log = event.payload;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== task.id) return t;
              let newProgress = t.progress;
              let newPhase = t.phase;

              if (log.includes("[download]") && log.includes("%")) {
                const match = log.match(/\[download\]\s+([\d\.]+)%/);
                if (match) {
                  newProgress = parseFloat(match[1]);
                  newPhase = "Downloading";
                }
              } else if (
                log.includes("Attempting encoder:") ||
                log.includes("Starting FFmpeg")
              ) {
                newPhase = "Transcoding (Hardware)";
                newProgress = 100;
              } else if (log.includes("Success! Transcoded")) {
                newPhase = "Finalizing...";
              }

              return {
                ...t,
                logs: [...t.logs, log],
                progress: newProgress,
                phase: newPhase,
              };
            }),
          );
        },
      );

      try {
        await invoke("download_video", {
          url: `https://www.youtube.com/watch?v=${task.id}`,
          metadata: task.metadata,
          quality: downloadQuality(),
        });
        updateTask(task.id, {
          status: "done",
          phase: "Complete",
          progress: 100,
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, logs: [...t.logs, "Download complete!"] }
              : t,
          ),
        );
      } catch (e) {
        updateTask(task.id, { status: "error", phase: "Failed" });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, logs: [...t.logs, `ERROR: ${e}`] } : t,
          ),
        );
      } finally {
        unlisten();
      }
    }
  } catch (e) {
    console.error("Queue Initialization Error:", e);
  } finally {
    setIsProcessingQueue(false);
    invoke<VideoEntry[]>("get_downloaded_videos")
      .then(setHomeVideos)
      .catch(console.error);
  }
};
