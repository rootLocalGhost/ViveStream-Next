// File: src/store.ts
import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getBool = (key: string, def: boolean) =>
  isBrowser && window.localStorage.getItem(key) !== null
    ? window.localStorage.getItem(key) === "true"
    : def;

const getStr = (key: string, def: string) =>
  isBrowser && window.localStorage.getItem(key) !== null
    ? window.localStorage.getItem(key)!
    : def;

const getNum = (key: string, def: number) =>
  isBrowser && window.localStorage.getItem(key) !== null
    ? parseInt(window.localStorage.getItem(key)!, 10)
    : def;

const initialAnimState = getBool("useAnimatedIcons", true);
const initialHoverState = getBool("sidebarHoverMode", true);
const initialTheme = getStr("appTheme", "dark");
const initialPalette = getStr("appPalette", "sunset");

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

export const [concurrentDownloads, setConcurrentDownloads] = createSignal(
  getNum("concurrentDownloads", 3),
);
export const updateConcurrentDownloads = (val: number) => {
  setConcurrentDownloads(val);
  if (isBrowser)
    window.localStorage.setItem("concurrentDownloads", val.toString());
  processQueue();
};

export const [concurrentFragments, setConcurrentFragments] = createSignal(
  getNum("concurrentFragments", 1),
);
export const updateConcurrentFragments = (val: number) => {
  setConcurrentFragments(val);
  if (isBrowser)
    window.localStorage.setItem("concurrentFragments", val.toString());
};

export const [speedLimit, setSpeedLimit] = createSignal(
  getStr("speedLimit", ""),
);
export const updateSpeedLimit = (val: string) => {
  setSpeedLimit(val);
  if (isBrowser) window.localStorage.setItem("speedLimit", val);
};

export const [browserCookies, setBrowserCookies] = createSignal(
  getStr("browserCookies", "None"),
);
export const updateBrowserCookies = (val: string) => {
  setBrowserCookies(val);
  if (isBrowser) window.localStorage.setItem("browserCookies", val);
};

export const [autoSubtitles, setAutoSubtitles] = createSignal(
  getBool("autoSubtitles", false),
);
export const toggleAutoSubtitles = (val: boolean) => {
  setAutoSubtitles(val);
  if (isBrowser) window.localStorage.setItem("autoSubtitles", val.toString());
};

export const [removeSponsorBlock, setRemoveSponsorBlock] = createSignal(
  getBool("removeSponsorBlock", false),
);
export const toggleRemoveSponsorBlock = (val: boolean) => {
  setRemoveSponsorBlock(val);
  if (isBrowser)
    window.localStorage.setItem("removeSponsorBlock", val.toString());
};

export const [downloadType, setDownloadType] = createSignal(
  getStr("downloadType", "Video"),
);
export const updateDownloadType = (val: string) => {
  setDownloadType(val);
  if (isBrowser) window.localStorage.setItem("downloadType", val);
};

export const [dlSubtitles, setDlSubtitles] = createSignal(
  getBool("dlSubtitles", true),
);
export const toggleDlSubtitles = (val: boolean) => {
  setDlSubtitles(val);
  if (isBrowser) window.localStorage.setItem("dlSubtitles", val.toString());
};

export const [liveFromStart, setLiveFromStart] = createSignal(
  getBool("liveFromStart", false),
);
export const toggleLiveFromStart = (val: boolean) => {
  setLiveFromStart(val);
  if (isBrowser) window.localStorage.setItem("liveFromStart", val.toString());
};

export const [forceSetup, setForceSetup] = createSignal(false);

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

export const [downloadQuality, setDownloadQuality] = createSignal(
  getStr("downloadQuality", "1440p"),
);
export const updateDownloadQuality = (val: string) => {
  setDownloadQuality(val);
  if (isBrowser) window.localStorage.setItem("downloadQuality", val);
};

export const [tasks, setTasks] = createSignal<DownloadTask[]>([]);
export const [isProcessingQueue, setIsProcessingQueue] = createSignal(false);
export const [homeVideos, setHomeVideos] = createSignal<VideoEntry[]>([]);

export const updateTask = (id: string, updates: Partial<DownloadTask>) => {
  setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
};

export const clearDownloadHistory = () => {
  setTasks((prev) =>
    prev.filter((t) => t.status !== "done" && t.status !== "error"),
  );
};

const processQueue = () => {
  const allTasks = tasks();
  const activeCount = allTasks.filter((t) => t.status === "downloading").length;
  const pendingTasks = allTasks.filter((t) => t.status === "pending");

  if (activeCount >= concurrentDownloads() || pendingTasks.length === 0) {
    setIsProcessingQueue(activeCount > 0);
    if (activeCount === 0 && pendingTasks.length === 0) {
      invoke<VideoEntry[]>("get_downloaded_videos")
        .then(setHomeVideos)
        .catch(console.error);
    }
    return;
  }

  setIsProcessingQueue(true);
  const slotsAvailable = concurrentDownloads() - activeCount;
  const tasksToStart = pendingTasks.slice(0, slotsAvailable);

  tasksToStart.forEach((task) => {
    executeDownload(task);
  });
};

const executeDownload = async (task: DownloadTask) => {
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

          const cleanLog = log.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

          if (cleanLog.includes("[download]") && cleanLog.includes("%")) {
            const match = cleanLog.match(/\[download\][^0-9]*([\d\.]+)%/);
            if (match) {
              newProgress = parseFloat(match[1]);
              newPhase = "Downloading";
            }
          } else if (
            cleanLog.includes("Attempting encoder:") ||
            cleanLog.includes("Starting FFmpeg")
          ) {
            newPhase = "Transcoding (Hardware)";
            newProgress = 100;
          } else if (cleanLog.includes("Success! Transcoded")) {
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
      dlType: downloadType(),
      cookies: browserCookies(),
      speedLimit: speedLimit(),
      concurrentFragments: concurrentFragments(),
      autoSubs: autoSubtitles(),
      dlSubs: dlSubtitles(),
      sponsorblock: removeSponsorBlock(),
      liveFromStart: liveFromStart(),
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
    processQueue();
  }
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
    processQueue();
  } catch (e) {
    console.error("Queue Initialization Error:", e);
    setIsProcessingQueue(false);
  }
};
