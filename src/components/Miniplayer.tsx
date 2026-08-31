import {
  Component,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  untrack,
  Show,
  For,
} from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import {
  activeVideo,
  setActiveVideo,
  isPlaying,
  setIsPlaying,
  currentTime,
  setCurrentTime,
  duration,
  setDuration,
  volume,
  setVolume,
  isMuted,
  setIsMuted,
  playbackRate,
  setPlaybackRate,
  isLooping,
  setIsLooping,
  subtitlesEnabled,
  setSubtitlesEnabled,
  playerQueue,
  setPlayerQueue,
  miniplayerDismissed,
  setMiniplayerDismissed,
  playerContextParams,
  setGlobalVideoRef,
  toggleGlobalPlay,
  toggleGlobalMute,
  toggleGlobalPiP,
  closeGlobalMiniplayer,
  seekGlobalPlay,
  theaterMode,
  setTheaterMode,
  playerAmbientMode,
  togglePlayerAmbientMode,
  playerAmbientColor,
  updatePlayerAmbientColor,
  playerAmbientType,
  togglePlayerAmbientType,
  playerAmbientIntensity,
  updatePlayerAmbientIntensity,
  playerAmbientBlur,
  updatePlayerAmbientBlur,
} from "../store";
import "./Miniplayer.css";

const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return "0:00";
  const h = Math.floor(timeInSeconds / 3600);
  const m = Math.floor((timeInSeconds % 3600) / 60);
  const s = Math.floor(timeInSeconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

export const Miniplayer: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isHovered, setIsHovered] = createSignal(false);
  const [isSeeking, setIsSeeking] = createSignal(false);
  const [seekTime, setSeekTime] = createSignal(0);
  const [currentDominantColor, setCurrentDominantColor] = createSignal("#f25c54");
  const [extractedVideoColors, setExtractedVideoColors] = createSignal<string[]>([]);

  let videoRef: HTMLVideoElement | undefined;
  let ambientCanvasRef: HTMLCanvasElement | undefined;
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let ambientCtx: CanvasRenderingContext2D | null = null;
  let ambientRafId: number | null = null;
  let lastAmbientDraw = 0;

  const isPlayerPage = () => {
    try {
      return location?.pathname ? location.pathname.startsWith("/player") : false;
    } catch {
      return typeof window !== "undefined"
        ? window.location.pathname.startsWith("/player")
        : false;
    }
  };

  const shouldShow = () => {
    return !isPlayerPage() && activeVideo() !== null && !miniplayerDismissed();
  };

  const extractDominantVideoColors = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): { dominant: string; palette: string[] } => {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const buckets = new Map<string, { r: number; g: number; b: number; count: number; sat: number }>();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) continue;
        const qr = Math.round(r / 28) * 28;
        const qg = Math.round(g / 28) * 28;
        const qb = Math.round(b / 28) * 28;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const sat = max === 0 ? 0 : delta / max;

        if (max < 30) continue;

        const key = `${qr},${qg},${qb}`;
        const existing = buckets.get(key);
        const weight = 1 + sat * 2.5;

        if (existing) {
          existing.count += weight;
        } else {
          buckets.set(key, { r: qr, g: qg, b: qb, count: weight, sat });
        }
      }

      if (buckets.size === 0) {
        return {
          dominant: "#f25c54",
          palette: ["#f25c54", "#ef233c", "#3b82f6", "#10b981", "#a855f7"],
        };
      }

      const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
      const top = sorted[0];
      const dominantHex = rgbToHex(top.r, top.g, top.b);

      const palette: string[] = [];
      for (const item of sorted) {
        const hex = rgbToHex(item.r, item.g, item.b);
        const isDistinct = palette.every((existingHex) => {
          const er = parseInt(existingHex.slice(1, 3), 16);
          const eg = parseInt(existingHex.slice(3, 5), 16);
          const eb = parseInt(existingHex.slice(5, 7), 16);
          const dist = Math.sqrt((item.r - er) ** 2 + (item.g - eg) ** 2 + (item.b - eb) ** 2);
          return dist > 45;
        });
        if (isDistinct) {
          palette.push(hex);
          if (palette.length >= 6) break;
        }
      }

      if (palette.length === 0) palette.push(dominantHex);

      return { dominant: dominantHex, palette };
    } catch {
      return {
        dominant: "#f25c54",
        palette: ["#f25c54", "#ef233c", "#3b82f6", "#10b981", "#a855f7"],
      };
    }
  };

  const drawAmbientFrame = (now?: number) => {
    if (!videoRef || !playerAmbientMode()) {
      return;
    }
    const time = now ?? performance.now();
    if (time - lastAmbientDraw >= 40) {
      if (!offscreenCanvas) {
        offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = 32;
        offscreenCanvas.height = 18;
        offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
      }

      if (offscreenCtx && videoRef.readyState >= 2) {
        try {
          offscreenCtx.drawImage(videoRef, 0, 0, 32, 18);
          const { dominant, palette } = extractDominantVideoColors(offscreenCtx, 32, 18);
          setCurrentDominantColor(dominant);
          if (palette.length > 0) {
            setExtractedVideoColors(palette);
          }
        } catch {}
      }
      lastAmbientDraw = time;
    }
    if (isPlaying() && shouldShow()) {
      ambientRafId = requestAnimationFrame(drawAmbientFrame);
    }
  };

  createEffect(() => {
    const playing = isPlaying();
    const ambient = playerAmbientMode();
    const show = shouldShow();
    if (playing && ambient && show) {
      if (ambientRafId) cancelAnimationFrame(ambientRafId);
      ambientRafId = requestAnimationFrame(drawAmbientFrame);
    } else {
      if (ambientRafId) {
        cancelAnimationFrame(ambientRafId);
        ambientRafId = null;
      }
      if (ambient && show && videoRef && videoRef.readyState >= 2) {
        drawAmbientFrame();
      }
    }
  });

  const handleExpand = (e?: Event) => {
    if (e) e.stopPropagation();
    const vid = activeVideo();
    if (!vid) return;
    if (videoRef) {
      setCurrentTime(videoRef.currentTime);
    }
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

  const handleSliderInput = (e: Event) => {
    e.stopPropagation();
    setIsSeeking(true);
    const val = parseFloat((e.target as HTMLInputElement).value);
    setSeekTime(val);
  };

  const handleSliderChange = (e: Event) => {
    e.stopPropagation();
    setIsSeeking(false);
    const val = parseFloat((e.target as HTMLInputElement).value);
    seekGlobalPlay(val);
  };

  createEffect(() => {
    if (shouldShow() && videoRef) {
      setGlobalVideoRef(videoRef);
      videoRef.volume = volume();
      videoRef.muted = isMuted();

      const initialTime = untrack(() => currentTime());
      if (
        initialTime > 0 &&
        Math.abs(videoRef.currentTime - initialTime) > 0.5
      ) {
        videoRef.currentTime = initialTime;
      }
      const initialPlaying = untrack(() => isPlaying());
      if (initialPlaying && videoRef.paused) {
        videoRef
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      }
    } else if (!shouldShow() && videoRef) {
      try {
        videoRef.pause();
        videoRef.removeAttribute("src");
        videoRef.load();
      } catch {}
    }
  });

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
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          handlePlayNext();
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handlePlayPrev();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      if (ambientRafId) {
        cancelAnimationFrame(ambientRafId);
        ambientRafId = null;
      }
    });
  });

  const seekProgress = () => {
    const total = duration();
    if (total <= 0) return 0;
    const current = isSeeking() ? seekTime() : currentTime();
    return (current / total) * 100;
  };

  const effectiveAmbientColor = () => {
    if (playerAmbientType() === "static") {
      return playerAmbientColor();
    }
    return currentDominantColor() || playerAmbientColor() || "#f25c54";
  };

  return (
    <Show when={shouldShow()}>
      <div
        class="miniplayer-container"
        onClick={handleExpand}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          "--mini-ambient-color": effectiveAmbientColor(),
          "--mini-ambient-blur": `${Math.min(50, playerAmbientBlur())}px`,
          "--mini-ambient-opacity": `${playerAmbientIntensity() / 100}`,
        } as any}
      >
        <Show when={playerAmbientMode()}>
          <div class="miniplayer-ambient-glow" aria-hidden="true"></div>
        </Show>

        <div class="miniplayer-card" onClick={handleExpand}>
          <div class="miniplayer-media-box" onClick={handleExpand}>
            <video
              ref={videoRef}
              class="miniplayer-video-element"
              src={`http://127.0.0.1:1422/Videos/${activeVideo()!.id}.mp4`}
              preload="auto"
              autoplay
              crossOrigin="anonymous"
              onCanPlay={() => {
                if (videoRef) {
                  const savedTime = untrack(currentTime);
                  if (savedTime > 0 && Math.abs(videoRef.currentTime - savedTime) > 0.5) {
                    videoRef.currentTime = savedTime;
                  }
                  if (untrack(isPlaying) && videoRef.paused) {
                    videoRef
                      .play()
                      .then(() => setIsPlaying(true))
                      .catch(() => setIsPlaying(false));
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
                    videoRef
                      .play()
                      .then(() => setIsPlaying(true))
                      .catch(() => setIsPlaying(false));
                  }
                }
              }}
              onSeeked={() => {
                if (videoRef && untrack(isPlaying) && videoRef.paused) {
                  videoRef
                    .play()
                    .then(() => setIsPlaying(true))
                    .catch(() => setIsPlaying(false));
                }
              }}
              onPlay={() => {
                if (!shouldShow()) return;
                setIsPlaying(true);
                invoke("update_playback_status", { playing: true }).catch(() => {});
              }}
              onPause={() => {
                if (!shouldShow() || (videoRef && videoRef.seeking)) return;
                setIsPlaying(false);
                invoke("update_playback_status", { playing: false }).catch(() => {});
              }}
              onTimeUpdate={(e) => {
                if (!isSeeking() && shouldShow()) {
                  setCurrentTime(e.currentTarget.currentTime);
                  if (videoRef && videoRef.paused && isPlaying() && !videoRef.seeking) {
                    setIsPlaying(false);
                  }
                }
              }}
              onEnded={handlePlayNext}
            />

            <div class="miniplayer-top-row">
              <div class="miniplayer-badge" onClick={handleExpand} title="Expand to Full Player">
                <i class="ph-fill ph-airplay"></i>
                <span>Miniplayer</span>
              </div>
              <div class="miniplayer-top-actions">
                <button type="button" class="miniplayer-icon-btn" onClick={handleExpand} title="Expand (I)">
                  <i class="ph-bold ph-corners-out"></i>
                </button>
                <button type="button" class="miniplayer-icon-btn" onClick={(e) => { e.stopPropagation(); toggleGlobalPiP(); }} title="Picture-in-Picture">
                  <i class="ph-bold ph-picture-in-picture"></i>
                </button>
                <button type="button" class="miniplayer-icon-btn close-btn" onClick={(e) => { e.stopPropagation(); closeGlobalMiniplayer(); }} title="Close Miniplayer">
                  <i class="ph-bold ph-x"></i>
                </button>
              </div>
            </div>

            <div class={`miniplayer-overlay ${isHovered() || isSeeking() ? "visible" : ""}`}>
              <div class="miniplayer-center-controls">
                <button type="button" class="miniplayer-ctrl-btn" onClick={handlePlayPrev} title="Previous Video (P)">
                  <i class="ph-fill ph-skip-back"></i>
                </button>
                <button type="button" class="miniplayer-ctrl-btn play-btn" onClick={(e) => { e.stopPropagation(); toggleGlobalPlay(); }} title={isPlaying() ? "Pause (Space)" : "Play (Space)"}>
                  <i class={`ph-fill ph-${isPlaying() ? "pause" : "play"}`}></i>
                </button>
                <button type="button" class="miniplayer-ctrl-btn" onClick={handlePlayNext} title="Next Video (N)">
                  <i class="ph-fill ph-skip-forward"></i>
                </button>
              </div>

              <div class="miniplayer-bottom-slider" onClick={(e) => e.stopPropagation()}>
                <input
                  type="range"
                  class="custom-slider mini-slider"
                  min="0"
                  max={duration() || 100}
                  step="0.1"
                  value={isSeeking() ? seekTime() : currentTime()}
                  onInput={handleSliderInput}
                  onChange={handleSliderChange}
                  style={{ "--progress": `${seekProgress()}%` } as any}
                  aria-label="Seek Video"
                />
              </div>
            </div>
          </div>

          <div class="miniplayer-meta-bar" onClick={handleExpand}>
            <div class="miniplayer-text-wrap">
              <span class="miniplayer-title" title={activeVideo()?.title}>
                {activeVideo()?.title || "Playing Media"}
              </span>
              <span class="miniplayer-channel" title={activeVideo()?.channel}>
                {activeVideo()?.channel || "Unknown Channel"}
              </span>
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
