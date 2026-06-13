import { createSignal, createRoot } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getBool = (key: string, def: boolean) => {
  if (!isBrowser) return def;
  const val = window.localStorage.getItem(key);
  return val === null || val === undefined ? def : val === "true";
};

const getStr = (key: string, def: string) => {
  if (!isBrowser) return def;
  const val = window.localStorage.getItem(key);
  return val === null || val === undefined ? def : val;
};

const getNum = (key: string, def: number) => {
  if (!isBrowser) return def;
  const val = window.localStorage.getItem(key);
  if (val === null || val === undefined) return def;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? def : parsed;
};

const initialAnimState = getBool("useAnimatedIcons", true);
const initialHoverState = getBool("sidebarHoverMode", true);
const initialTheme = getStr("appTheme", "dark");
const initialPalette = getStr("appPalette", "sunset");

if (isBrowser) {
  document.documentElement.setAttribute("data-theme", initialTheme);
  document.documentElement.setAttribute("data-palette", initialPalette);
}

export interface Toast {
  id: string;
  message: string;
  type: "info" | "error" | "success";
}

export interface DialogState {
  title: string;
  message: string;
  type: "info" | "warning" | "error";
  resolve: (value: boolean) => void;
}

export interface VideoEntry {
  id: string;
  title: string;
  channel: string;
  video_path: string;
  thumbnail_path: string;
  avatar_path: string;
  subtitle_path: string;
  desc_path: string;
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

// Wrap all global reactive signals inside createRoot
export const {
  toasts,
  setToasts,
  dialogState,
  setDialogState,
  useAnimatedIcons,
  setUseAnimatedIcons,
  sidebarHoverMode,
  setSidebarHoverMode,
  appTheme,
  setAppTheme,
  appPalette,
  setAppPalette,
  concurrentDownloads,
  setConcurrentDownloads,
  concurrentFragments,
  setConcurrentFragments,
  speedLimit,
  setSpeedLimit,
  browserCookies,
  setBrowserCookies,
  autoSubtitles,
  setAutoSubtitles,
  removeSponsorBlock,
  setRemoveSponsorBlock,
  downloadType,
  setDownloadType,
  dlSubtitles,
  setDlSubtitles,
  liveFromStart,
  setLiveFromStart,
  forceSetup,
  setForceSetup,
  downloadUrl,
  setDownloadUrl,
  downloadQuality,
  setDownloadQuality,
  tasks,
  setTasks,
  isProcessingQueue,
  setIsProcessingQueue,
  homeVideos,
  setHomeVideos,
} = createRoot(() => {
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  const [dialogState, setDialogState] = createSignal<DialogState | null>(null);
  const [useAnimatedIcons, setUseAnimatedIcons] =
    createSignal(initialAnimState);
  const [sidebarHoverMode, setSidebarHoverMode] =
    createSignal(initialHoverState);
  const [appTheme, setAppTheme] = createSignal(initialTheme);
  const [appPalette, setAppPalette] = createSignal(initialPalette);
  const [concurrentDownloads, setConcurrentDownloads] = createSignal(
    getNum("concurrentDownloads", 3),
  );
  const [concurrentFragments, setConcurrentFragments] = createSignal(
    getNum("concurrentFragments", 1),
  );
  const [speedLimit, setSpeedLimit] = createSignal(getStr("speedLimit", ""));
  const [browserCookies, setBrowserCookies] = createSignal(
    getStr("browserCookies", "None"),
  );
  const [autoSubtitles, setAutoSubtitles] = createSignal(
    getBool("autoSubtitles", false),
  );
  const [removeSponsorBlock, setRemoveSponsorBlock] = createSignal(
    getBool("removeSponsorBlock", false),
  );
  const [downloadType, setDownloadType] = createSignal(
    getStr("downloadType", "Video"),
  );
  const [dlSubtitles, setDlSubtitles] = createSignal(
    getBool("dlSubtitles", true),
  );
  const [liveFromStart, setLiveFromStart] = createSignal(
    getBool("liveFromStart", false),
  );
  const [forceSetup, setForceSetup] = createSignal(false);
  const [downloadUrl, setDownloadUrl] = createSignal("");
  const [downloadQuality, setDownloadQuality] = createSignal(
    getStr("downloadQuality", "1440p"),
  );
  const [tasks, setTasks] = createSignal<DownloadTask[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = createSignal(false);
  const [homeVideos, setHomeVideos] = createSignal<VideoEntry[]>([]);

  return {
    toasts,
    setToasts,
    dialogState,
    setDialogState,
    useAnimatedIcons,
    setUseAnimatedIcons,
    sidebarHoverMode,
    setSidebarHoverMode,
    appTheme,
    setAppTheme,
    appPalette,
    setAppPalette,
    concurrentDownloads,
    setConcurrentDownloads,
    concurrentFragments,
    setConcurrentFragments,
    speedLimit,
    setSpeedLimit,
    browserCookies,
    setBrowserCookies,
    autoSubtitles,
    setAutoSubtitles,
    removeSponsorBlock,
    setRemoveSponsorBlock,
    downloadType,
    setDownloadType,
    dlSubtitles,
    setDlSubtitles,
    liveFromStart,
    setLiveFromStart,
    forceSetup,
    setForceSetup,
    downloadUrl,
    setDownloadUrl,
    downloadQuality,
    setDownloadQuality,
    tasks,
    setTasks,
    isProcessingQueue,
    setIsProcessingQueue,
    homeVideos,
    setHomeVideos,
  };
});

export const addToast = (
  message: string,
  type: "info" | "error" | "success" = "info",
) => {
  const id = Math.random().toString(36).substring(2, 9);
  setToasts((prev) => [...prev, { id, message, type }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 4500);
};

export const showConfirmDialog = (
  message: string,
  title: string,
  type: "info" | "warning" | "error" = "info",
): Promise<boolean> => {
  return new Promise((resolve) => {
    setDialogState({ title, message, type, resolve });
  });
};

export const closeDialog = (result: boolean) => {
  const state = dialogState();
  if (state) {
    state.resolve(result);
    setDialogState(null);
  }
};

export const toggleAnimatedIcons = (val: boolean) => {
  setUseAnimatedIcons(val);
  if (isBrowser)
    window.localStorage.setItem("useAnimatedIcons", val.toString());
};

export const toggleSidebarHoverMode = (val: boolean) => {
  setSidebarHoverMode(val);
  if (isBrowser)
    window.localStorage.setItem("sidebarHoverMode", val.toString());
};

export const toggleAppTheme = (theme: "light" | "dark") => {
  setAppTheme(theme);
  if (isBrowser) {
    window.localStorage.setItem("appTheme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }
};

export const toggleAppPalette = (palette: string) => {
  setAppPalette(palette);
  if (isBrowser) {
    window.localStorage.setItem("appPalette", palette);
    document.documentElement.setAttribute("data-palette", palette);
  }
};

export const updateConcurrentDownloads = (val: number) => {
  setConcurrentDownloads(val);
  if (isBrowser)
    window.localStorage.setItem("concurrentDownloads", val.toString());
  processQueue();
};

export const updateConcurrentFragments = (val: number) => {
  setConcurrentFragments(val);
  if (isBrowser)
    window.localStorage.setItem("concurrentFragments", val.toString());
};

export const updateSpeedLimit = (val: string) => {
  setSpeedLimit(val);
  if (isBrowser) window.localStorage.setItem("speedLimit", val);
};

export const updateBrowserCookies = (val: string) => {
  setBrowserCookies(val);
  if (isBrowser) window.localStorage.setItem("browserCookies", val);
};

export const toggleAutoSubtitles = (val: boolean) => {
  setAutoSubtitles(val);
  if (isBrowser) window.localStorage.setItem("autoSubtitles", val.toString());
};

export const toggleRemoveSponsorBlock = (val: boolean) => {
  setRemoveSponsorBlock(val);
  if (isBrowser)
    window.localStorage.setItem("removeSponsorBlock", val.toString());
};

export const updateDownloadType = (val: string) => {
  setDownloadType(val);
  if (isBrowser) window.localStorage.setItem("downloadType", val);
};

export const toggleDlSubtitles = (val: boolean) => {
  setDlSubtitles(val);
  if (isBrowser) window.localStorage.setItem("dlSubtitles", val.toString());
};

export const toggleLiveFromStart = (val: boolean) => {
  setLiveFromStart(val);
  if (isBrowser) window.localStorage.setItem("liveFromStart", val.toString());
};

export const updateDownloadQuality = (val: string) => {
  setDownloadQuality(val);
  if (isBrowser) window.localStorage.setItem("downloadQuality", val);
};

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
    addToast(`Failed to initialize download: ${e}`, "error");
    setIsProcessingQueue(false);
  }
};
