import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  For,
  Show,
} from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface VideoEntry {
  id: string;
  title: string;
  channel: string;
  video_path: string;
  thumbnail_path: string;
}

const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds)) return "0:00";
  const h = Math.floor(timeInSeconds / 3600);
  const m = Math.floor((timeInSeconds % 3600) / 60);
  const s = Math.floor(timeInSeconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function Player() {
  const params = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = createSignal<VideoEntry | null>(null);
  const [queue, setQueue] = createSignal<VideoEntry[]>([]);
  const [theaterMode, setTheaterMode] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [showControls, setShowControls] = createSignal(true);
  const [isPlaying, setIsPlaying] = createSignal(true);
  const [isMuted, setIsMuted] = createSignal(false);
  const [volume, setVolume] = createSignal(1);
  const [isVolumeHovered, setIsVolumeHovered] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [isSeeking, setIsSeeking] = createSignal(false);
  let videoRef: HTMLVideoElement | undefined;
  let playerContainerRef: HTMLDivElement | undefined;
  let controlsTimeout: number;
  let unlistenPlay: UnlistenFn;
  let unlistenPause: UnlistenFn;
  let unlistenNext: UnlistenFn;
  let unlistenPrev: UnlistenFn;

  const loadVideoData = async (targetId?: string) => {
    if (!targetId) return;
    try {
      const db = await invoke<VideoEntry[]>("get_downloaded_videos");
      const currentIndex = db.findIndex((v) => v.id === targetId);
      if (currentIndex !== -1) {
        setVideo(db[currentIndex]);
        const nextVideos: VideoEntry[] = [];
        for (let i = 1; i <= 15; i++) {
          if (db[(currentIndex + i) % db.length]) {
            nextVideos.push(db[(currentIndex + i) % db.length]);
          }
        }
        const uniqueQueue = Array.from(
          new Set(nextVideos.map((a) => a.id)),
        ).map((id) => nextVideos.find((a) => a.id === id)!);
        setQueue(uniqueQueue.filter((v) => v.id !== targetId));
      }
    } catch (e) {
      console.error("Could not load video library", e);
    }
  };

  const handlePlay = () => {
    if (videoRef) {
      const playPromise = videoRef.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((e) => {
            if (e.name !== "AbortError") console.error("Playback error:", e);
          });
      }
    }
  };

  const handlePause = () => {
    if (videoRef) {
      videoRef.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => (isPlaying() ? handlePause() : handlePlay());

  const toggleMute = () => {
    if (videoRef) {
      videoRef.muted = !videoRef.muted;
      setIsMuted(videoRef.muted);
      if (!videoRef.muted && volume() === 0) {
        setVolume(0.5);
        videoRef.volume = 0.5;
      }
    }
  };

  const handleVolumeChange = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    setVolume(val);
    if (videoRef) {
      videoRef.volume = val;
      if (val > 0 && isMuted()) {
        videoRef.muted = false;
        setIsMuted(false);
      } else if (val === 0 && !isMuted()) {
        videoRef.muted = true;
        setIsMuted(true);
      }
    }
  };

  const handleSeek = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    setCurrentTime(val);
    if (videoRef) videoRef.currentTime = val;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef
        ?.requestFullscreen()
        .catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleVideoEnd = () => {
    const nextVideo = queue()[0];
    if (nextVideo) navigate(`/player/${nextVideo.id}`);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeout);
    if (isPlaying()) {
      controlsTimeout = window.setTimeout(() => setShowControls(false), 2500);
    }
  };

  onMount(async () => {
    await loadVideoData(params.id);
    unlistenPlay = await listen("media-play", () => handlePlay());
    unlistenPause = await listen("media-pause", () => handlePause());
    unlistenNext = await listen("media-next", () => handleVideoEnd());
    unlistenPrev = await listen("media-prev", () => {
      if (videoRef) videoRef.currentTime = 0;
    });
    document.addEventListener("fullscreenchange", () => {
      setIsFullscreen(!!document.fullscreenElement);
    });
  });

  onCleanup(() => {
    if (unlistenPlay) unlistenPlay();
    if (unlistenPause) unlistenPause();
    if (unlistenNext) unlistenNext();
    if (unlistenPrev) unlistenPrev();
  });

  createEffect(() => {
    loadVideoData(params.id);
  });

  createEffect(() => {
    if (video() && videoRef) {
      invoke("update_media_metadata", {
        title: video()!.title,
        artist: video()!.channel,
      });
      videoRef.currentTime = 0;
      handlePlay();
    }
  });

  const seekProgress = () =>
    duration() > 0 ? (currentTime() / duration()) * 100 : 0;
  const volProgress = () => (isMuted() ? 0 : volume() * 100);

  return (
    <div
      classList={{
        "player-page-container": true,
        "is-theater": theaterMode(),
        "is-fullscreen": isFullscreen(),
      }}
    >
      <div class="player-main-col">
        <Show
          when={video()}
          fallback={<p style={{ padding: "24px" }}>Loading player...</p>}
        >
          <div
            class="player-video-wrapper"
            ref={playerContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying() && setShowControls(false)}
          >
            <video
              class="player-video-element"
              ref={videoRef}
              preload="auto"
              onEnded={handleVideoEnd}
              onPlay={() => {
                invoke("update_playback_status", { playing: true });
                setIsPlaying(true);
              }}
              onPause={() => {
                invoke("update_playback_status", { playing: false });
                setIsPlaying(false);
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => {
                if (!isSeeking()) setCurrentTime(e.currentTarget.currentTime);
              }}
              onClick={togglePlay}
              src={`http://127.0.0.1:1422/Videos/${video()!.id}.mp4`}
            />

            <div
              class="player-controls-overlay"
              style={{
                opacity: showControls() || !isPlaying() ? 1 : 0,
                "pointer-events":
                  showControls() || !isPlaying() ? "auto" : "none",
              }}
            >
              <input
                class="custom-slider"
                type="range"
                min="0"
                max={duration() || 0}
                value={currentTime()}
                step="0.1"
                onInput={handleSeek}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                style={{ "--progress": `${seekProgress()}%` } as any}
              />
              <div
                style={{
                  display: "flex",
                  "justify-content": "space-between",
                  "align-items": "center",
                  "margin-top": "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "4px",
                  }}
                >
                  <button
                    class="control-btn"
                    onClick={togglePlay}
                    title={isPlaying() ? "Pause" : "Play"}
                  >
                    <i
                      class={`ph-fill ph-${isPlaying() ? "pause" : "play"}`}
                    ></i>
                  </button>

                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setIsVolumeHovered(true)}
                    onMouseLeave={() => setIsVolumeHovered(false)}
                  >
                    <button
                      class="control-btn"
                      onClick={toggleMute}
                      title={isMuted() ? "Unmute" : "Mute"}
                    >
                      <i
                        class={`ph-fill ph-${isMuted() || volume() === 0 ? "speaker-slash" : volume() < 0.5 ? "speaker-low" : "speaker-high"}`}
                      ></i>
                    </button>
                    <div
                      style={{
                        width: isVolumeHovered() ? "80px" : "0px",
                        height: "24px",
                        overflow: "hidden",
                        transition: "width 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
                        display: "flex",
                        "align-items": "center",
                        "padding-left": isVolumeHovered() ? "4px" : "0",
                      }}
                    >
                      <input
                        class="custom-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted() ? 0 : volume()}
                        onInput={handleVolumeChange}
                        style={
                          {
                            width: "70px",
                            "--progress": `${volProgress()}%`,
                          } as any
                        }
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      color: "#eee",
                      "font-size": "13px",
                      "font-weight": "500",
                      "font-family": "var(--font-body)",
                      "margin-left": "8px",
                    }}
                  >
                    {formatTime(currentTime())}{" "}
                    <span style={{ opacity: 0.6 }}>/</span>{" "}
                    {formatTime(duration())}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "4px",
                  }}
                >
                  <button class="control-btn" title="Subtitles/CC">
                    <i class="ph-fill ph-closed-captioning"></i>
                  </button>
                  <button class="control-btn" title="Settings">
                    <i class="ph-fill ph-gear"></i>
                  </button>
                  <button
                    class="control-btn"
                    onClick={() => setTheaterMode(!theaterMode())}
                    title={theaterMode() ? "Default view" : "Theater mode"}
                  >
                    <i
                      class={
                        theaterMode() ? "ph-fill ph-monitor" : "ph ph-monitor"
                      }
                    ></i>
                  </button>
                  <button
                    class="control-btn"
                    onClick={toggleFullscreen}
                    title="Fullscreen"
                  >
                    <i
                      class={`ph-fill ph-${isFullscreen() ? "corners-in" : "corners-out"}`}
                    ></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="player-meta-block">
            <h1
              style={{
                "font-size": "22px",
                margin: "0 0 16px 0",
                "font-weight": "700",
                color: "var(--primary-text)",
                "line-height": "1.3",
              }}
            >
              {video()!.title}
            </h1>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "12px",
                "margin-bottom": "16px",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  "border-radius": "50%",
                  background: "var(--tertiary-background)",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  "flex-shrink": "0",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <i
                  class="ph-fill ph-user"
                  style={{
                    "font-size": "22px",
                    color: "var(--secondary-text)",
                  }}
                ></i>
              </div>
              <div>
                <h3
                  style={{
                    margin: "0",
                    "font-size": "16px",
                    "font-weight": "600",
                    color: "var(--primary-text)",
                  }}
                >
                  {video()!.channel}
                </h3>
              </div>
            </div>
            <div class="player-desc-box">
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  "font-weight": "600",
                  "margin-bottom": "8px",
                }}
              >
                <span>{formatTime(duration())} length</span>
                <span>•</span>
                <span>Local Hardware Library</span>
              </div>
              <p style={{ margin: "0", color: "var(--secondary-text)" }}>
                Description parsing is currently disabled. Data fetches for
                localized channel icons and Markdown descriptions will be
                architected in the database schema refactor.
              </p>
              <p
                style={{
                  margin: "12px 0 0 0",
                  "font-weight": "600",
                  color: "var(--primary-text)",
                }}
              >
                Show more
              </p>
            </div>
          </div>
        </Show>
      </div>

      <div class="player-sidebar">
        <h3
          style={{
            margin: "0 0 4px 0",
            "font-size": "18px",
            "font-weight": "600",
            color: "var(--primary-text)",
          }}
        >
          Up next
        </h3>
        <For each={queue()}>
          {(qVideo) => (
            <div
              class="queue-item"
              onClick={() => navigate(`/player/${qVideo.id}`)}
            >
              <div
                style={{
                  position: "relative",
                  width: "168px",
                  "flex-shrink": "0",
                }}
              >
                <img
                  src={`http://127.0.0.1:1422/Thumbnails/${qVideo.id}.jpg`}
                  style={{
                    width: "100%",
                    "aspect-ratio": "16/9",
                    "object-fit": "cover",
                    "border-radius": "8px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "justify-content": "flex-start",
                  padding: "2px 0",
                }}
              >
                <span
                  style={{
                    color: "var(--primary-text)",
                    "font-size": "14px",
                    "font-weight": "500",
                    display: "-webkit-box",
                    "-webkit-line-clamp": "2",
                    "-webkit-box-orient": "vertical",
                    overflow: "hidden",
                    "line-height": "1.4",
                  }}
                >
                  {qVideo.title}
                </span>
                <span
                  style={{
                    color: "var(--secondary-text)",
                    "font-size": "12px",
                    "margin-top": "6px",
                  }}
                >
                  {qVideo.channel}
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
