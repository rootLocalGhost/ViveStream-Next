import {
  Component,
  createSignal,
  Show,
  onMount,
  onCleanup,
  createEffect,
  untrack,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  activeVideo,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playerQueue,
  miniplayerDismissed,
  playerContextParams,
  toggleGlobalPlay,
  seekGlobalPlay,
  toggleGlobalMute,
  closeGlobalMiniplayer,
  setGlobalVideoRef,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  setActiveVideo,
} from "../store";
import { invoke } from "@tauri-apps/api/core";
import "./Miniplayer.css";

const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds)) return "0:00";
  const m = Math.floor(timeInSeconds / 60);
  const s = Math.floor(timeInSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const Miniplayer: Component = () => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = createSignal(false);
  const [isSeeking, setIsSeeking] = createSignal(false);
  let isUnmounting = false;

  let videoRef: HTMLVideoElement | undefined;

  const isPlayerPage = () => {
    try {
      return useLocation().pathname.startsWith("/player");
    } catch {
      return typeof window !== "undefined"
        ? window.location.pathname.startsWith("/player")
        : false;
    }
  };

  const shouldShow = () => {
    return !isPlayerPage() && activeVideo() !== null && !miniplayerDismissed();
  };

  const handleExpand = (e?: Event) => {
    if (e) e.stopPropagation();
    const vid = activeVideo();
    if (!vid) return;
    isUnmounting = true;
    const playState = isPlaying();
    if (videoRef) {
      setCurrentTime(videoRef.currentTime);
      try {
        videoRef.pause();
        videoRef.removeAttribute("src");
        videoRef.load();
      } catch {}
    }
    setIsPlaying(playState);
    const params = playerContextParams();
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    navigate(`/player/${vid.id}${qs ? `?${qs}` : ""}`);
  };

  const handlePlayNext = (e?: Event) => {
    if (e) e.stopPropagation();
    const q = playerQueue();
    if (q.length > 0) {
      const nextVid = q[0];
      setPlayerQueue(q.slice(1));
      setCurrentTime(0);
      setIsPlaying(true);
      setActiveVideo(nextVid);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handlePlayPrev = async (e?: Event) => {
    if (e) e.stopPropagation();
    const vid = activeVideo();
    if (!vid) return;
    try {
      const db = await invoke<any[]>("get_downloaded_videos");
      const currentIndex = db.findIndex((v) => v.id === vid.id);
      let prevVid = null;
      if (currentIndex > 0) {
        prevVid = db[currentIndex - 1];
      } else if (db.length > 0) {
        prevVid = db[db.length - 1];
      }
      if (prevVid) {
        setCurrentTime(0);
        setIsPlaying(true);
        setActiveVideo(prevVid);
      }
    } catch (err) {
      console.error("Failed to play previous:", err);
    }
  };

  const handleSeek = (e: Event) => {
    e.stopPropagation();
    const val = parseFloat((e.target as HTMLInputElement).value);
    seekGlobalPlay(val);
  };

  // Synchronize the video element reference when on miniplayer WITHOUT tracking currentTime
  createEffect(() => {
    if (shouldShow() && videoRef) {
      setGlobalVideoRef(videoRef);
      videoRef.volume = volume();
      videoRef.muted = isMuted();

      const initialTime = untrack(() => currentTime());
      if (
        initialTime > 0 &&
        Math.abs(videoRef.currentTime - initialTime) > 1.5
      ) {
        videoRef.currentTime = initialTime;
      }
      const initialPlaying = untrack(() => isPlaying());
      if (initialPlaying && videoRef.paused) {
        videoRef.play().catch(() => {});
      }
    } else if (!shouldShow() && videoRef) {
      try {
        videoRef.pause();
        videoRef.removeAttribute("src");
        videoRef.load();
      } catch {}
    }
  });

  // Dedicated light effect for volume & mute changes
  createEffect(() => {
    if (videoRef) {
      videoRef.volume = volume();
      videoRef.muted = isMuted();
    }
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (shouldShow()) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          handleExpand();
        }
        if (e.code === "Space" || e.key === "k" || e.key === "K") {
          e.preventDefault();
          toggleGlobalPlay();
        }
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          toggleGlobalMute();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      isUnmounting = true;
      window.removeEventListener("keydown", handleKeyDown);
      if (videoRef) {
        setCurrentTime(videoRef.currentTime);
        try {
          videoRef.pause();
          videoRef.removeAttribute("src");
          videoRef.load();
        } catch {}
      }
    });
  });

  const seekProgress = () =>
    duration() > 0 ? (currentTime() / duration()) * 100 : 0;

  return (
    <Show when={shouldShow()}>
      <div
        class="miniplayer-container"
        onClick={handleExpand}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div class="miniplayer-card" onClick={handleExpand}>
          <div class="miniplayer-media-box" onClick={handleExpand}>
            <video
              ref={videoRef}
              class="miniplayer-video-element"
              src={`http://127.0.0.1:1422/Videos/${activeVideo()!.id}.mp4`}
              preload="auto"
              autoplay
              onCanPlay={() => {
                if (videoRef) {
                  const savedTime = untrack(currentTime);
                  if (savedTime > 0 && Math.abs(videoRef.currentTime - savedTime) > 0.5) {
                    videoRef.currentTime = savedTime;
                  }
                  if (untrack(isPlaying) && videoRef.paused) {
                    videoRef.play().catch(() => {});
                  }
                }
              }}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                if (videoRef) {
                  const savedTime = untrack(currentTime);
                  if (savedTime > 0) {
                    videoRef.currentTime = savedTime;
                  }
                  if (untrack(isPlaying) && videoRef.paused) {
                    videoRef.play().catch(() => {});
                  }
                }
              }}
              onPlay={() => {
                if (isUnmounting || !shouldShow()) return;
                setIsPlaying(true);
                invoke("update_playback_status", { playing: true }).catch(
                  () => {},
                );
              }}
              onPause={() => {
                if (isUnmounting || !shouldShow() || (videoRef && videoRef.seeking)) return;
                setIsPlaying(false);
                invoke("update_playback_status", { playing: false }).catch(
                  () => {},
                );
              }}
              onTimeUpdate={(e) => {
                if (!isSeeking() && shouldShow() && !isUnmounting) {
                  setCurrentTime(e.currentTarget.currentTime);
                }
              }}
              onEnded={handlePlayNext}
            />

            {/* Top Row Controls */}
            <div class="miniplayer-top-row">
              <div class="miniplayer-badge" onClick={handleExpand}>
                <i class="ph-fill ph-picture-in-picture"></i>
                <span>Miniplayer</span>
              </div>
              <div class="miniplayer-top-actions">
                <button
                  class="miniplayer-icon-btn"
                  onClick={handleExpand}
                  title="Expand to Full Player (I)"
                >
                  <i class="ph-bold ph-arrows-out-simple"></i>
                </button>
                <button
                  class="miniplayer-icon-btn close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGlobalMiniplayer();
                  }}
                  title="Close Miniplayer"
                >
                  <i class="ph-bold ph-x"></i>
                </button>
              </div>
            </div>

            {/* Hover overlay with playback controls and seekbar */}
            <div class={`miniplayer-overlay ${isHovered() ? "visible" : ""}`}>
              <div
                class="miniplayer-center-controls"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  class="miniplayer-ctrl-btn"
                  onClick={handlePlayPrev}
                  title="Previous"
                >
                  <i class="ph-fill ph-skip-back"></i>
                </button>
                <button
                  class="miniplayer-ctrl-btn play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGlobalPlay();
                  }}
                  title={isPlaying() ? "Pause" : "Play"}
                >
                  <i class={`ph-fill ph-${isPlaying() ? "pause" : "play"}`}></i>
                </button>
                <button
                  class="miniplayer-ctrl-btn"
                  onClick={handlePlayNext}
                  title="Next"
                >
                  <i class="ph-fill ph-skip-forward"></i>
                </button>
              </div>

              <div
                class="miniplayer-bottom-slider"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  class="custom-slider mini-slider"
                  type="range"
                  min="0"
                  max={duration() || 0}
                  step="0.1"
                  value={currentTime()}
                  onInput={handleSeek}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsSeeking(true);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    setIsSeeking(false);
                  }}
                  style={{ "--progress": `${seekProgress()}%` } as any}
                />
              </div>
            </div>
          </div>

          <div class="miniplayer-meta-bar" onClick={handleExpand}>
            <div class="miniplayer-text-wrap">
              <span class="miniplayer-title" title={activeVideo()!.title}>
                {activeVideo()!.title}
              </span>
              <span class="miniplayer-channel">{activeVideo()!.channel}</span>
            </div>
            <span class="miniplayer-time">
              {formatTime(currentTime())} / {formatTime(duration())}
            </span>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default Miniplayer;
