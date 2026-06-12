import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  For,
  Show,
} from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { VideoEntry } from "../store";
import "./Player.css";

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
  const [description, setDescription] = createSignal<string>("");
  const [descExpanded, setDescExpanded] = createSignal(false);
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
  const [isFavorite, setIsFavorite] = createSignal(false);
  const [showSettingsMenu, setShowSettingsMenu] = createSignal(false);
  const [showCCMenu, setShowCCMenu] = createSignal(false);
  const [playbackRate, setPlaybackRate] = createSignal(1.0);
  const [autoplay, setAutoplay] = createSignal(true);
  const [hasSubtitles, setHasSubtitles] = createSignal(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = createSignal(false);
  const [subColor, setSubColor] = createSignal("#ffffff");
  const [subBg, setSubBg] = createSignal("rgba(0,0,0,0.8)");
  const [subSize, setSubSize] = createSignal("18px");
  const [subPos, setSubPos] = createSignal("-20px");

  let videoRef: HTMLVideoElement | undefined;
  let playerContainerRef: HTMLDivElement | undefined;
  let settingsMenuRef: HTMLDivElement | undefined;
  let ccMenuRef: HTMLDivElement | undefined;
  let controlsTimeout: number;

  let unlistenPlay: UnlistenFn | undefined;
  let unlistenPause: UnlistenFn | undefined;
  let unlistenNext: UnlistenFn | undefined;
  let unlistenPrev: UnlistenFn | undefined;

  const loadVideoData = async (targetId?: string) => {
    if (!targetId) return;
    try {
      const db = await invoke<VideoEntry[]>("get_downloaded_videos");
      const currentIndex = db.findIndex((v) => v.id === targetId);

      if (currentIndex !== -1) {
        const activeVideo = db[currentIndex];
        setVideo(activeVideo);
        setDescExpanded(false);
        setSubtitlesEnabled(false);

        const favStatus = await invoke<boolean>("check_favorite", {
          id: targetId,
        });
        setIsFavorite(favStatus);

        try {
          const descRes = await fetch(convertFileSrc(activeVideo.desc_path));
          if (descRes.ok) {
            setDescription(await descRes.text());
          } else {
            setDescription("No description available.");
          }
        } catch {
          setDescription("No description available.");
        }

        try {
          const subRes = await fetch(convertFileSrc(activeVideo.subtitle_path));
          if (subRes.ok) {
            const text = await subRes.text();
            setHasSubtitles(text.trim().length > 15);
          } else {
            setHasSubtitles(false);
          }
        } catch {
          setHasSubtitles(false);
        }

        const queueList = [
          ...db.slice(currentIndex + 1),
          ...db.slice(0, currentIndex),
        ];
        setQueue(queueList);
      }
    } catch (e) {
      console.error("Could not load video library", e);
    }
  };

  const toggleFavoriteStatus = async () => {
    if (!video()) return;
    try {
      const newStatus = !isFavorite();
      await invoke("toggle_favorite", {
        id: video()!.id,
        isFavorite: newStatus,
      });
      setIsFavorite(newStatus);
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
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

  const playNext = () => {
    const nextVideo = queue()[0];
    if (nextVideo) navigate(`/player/${nextVideo.id}`);
  };

  const playPrev = () => {
    if (videoRef && videoRef.currentTime > 3) {
      videoRef.currentTime = 0;
      return;
    }
    const prevVideo = queue()[queue().length - 1];
    if (prevVideo) navigate(`/player/${prevVideo.id}`);
  };

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
    if (!autoplay() && videoRef) {
      videoRef.currentTime = 0;
      handlePlay();
      return;
    }
    playNext();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeout);

    if (isPlaying()) {
      controlsTimeout = window.setTimeout(() => {
        if (!showSettingsMenu() && !showCCMenu()) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  const togglePiP = async () => {
    if (videoRef) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.requestPictureInPicture();
        }
      } catch (err) {
        console.error("PiP failed", err);
      }
    }
  };

  const toggleCC = () => {
    if (videoRef && videoRef.textTracks.length > 0) {
      const state = !subtitlesEnabled();
      setSubtitlesEnabled(state);
      for (let i = 0; i < videoRef.textTracks.length; i++) {
        videoRef.textTracks[i].mode = state ? "showing" : "hidden";
      }
    }
  };

  const changeSpeed = (rate: number) => {
    if (videoRef) {
      videoRef.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettingsMenu(false);
  };

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef && !settingsMenuRef.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (ccMenuRef && !ccMenuRef.contains(e.target as Node)) {
        setShowCCMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    listen("media-play", () => handlePlay()).then((f) => (unlistenPlay = f));
    listen("media-pause", () => handlePause()).then((f) => (unlistenPause = f));
    listen("media-next", () => playNext()).then((f) => (unlistenNext = f));
    listen("media-prev", () => playPrev()).then((f) => (unlistenPrev = f));

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (unlistenPlay) unlistenPlay();
      if (unlistenPause) unlistenPause();
      if (unlistenNext) unlistenNext();
      if (unlistenPrev) unlistenPrev();
    });
  });

  createEffect(() => {
    loadVideoData(params.id);
  });

  createEffect(() => {
    if (video() && videoRef) {
      videoRef.load();
      invoke("update_media_metadata", {
        title: video()!.title,
        artist: video()!.channel,
      });
      videoRef.playbackRate = playbackRate();
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
          fallback={<div class="flex-row-gap">Loading engine...</div>}
        >
          <div
            class="player-video-wrapper"
            ref={playerContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() =>
              isPlaying() &&
              !showSettingsMenu() &&
              !showCCMenu() &&
              setShowControls(false)
            }
          >
            <video
              class="player-video-element"
              ref={videoRef}
              preload="auto"
              crossorigin="anonymous"
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
              onClick={() => {
                setShowSettingsMenu(false);
                setShowCCMenu(false);
                togglePlay();
              }}
              src={convertFileSrc(video()!.video_path)}
              style={
                {
                  "--sub-color": subColor(),
                  "--sub-bg": subBg(),
                  "--sub-size": subSize(),
                  "--sub-pos": subPos(),
                } as any
              }
            >
              <track
                kind="captions"
                src={convertFileSrc(video()!.subtitle_path)}
                default={subtitlesEnabled()}
              />
            </video>

            <div
              class={
                showControls() || !isPlaying()
                  ? "player-controls-overlay visible"
                  : "player-controls-overlay"
              }
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

              <div class="flex-row-between player-controls-bar">
                <div class="flex-row-gap gap-4">
                  <button
                    class="control-btn"
                    onClick={playPrev}
                    title="Previous"
                  >
                    <i class="ph-fill ph-skip-back"></i>
                  </button>
                  <button
                    class="control-btn"
                    onClick={togglePlay}
                    title={isPlaying() ? "Pause" : "Play"}
                  >
                    <i
                      class={`ph-fill ph-${isPlaying() ? "pause" : "play"}`}
                    ></i>
                  </button>
                  <button class="control-btn" onClick={playNext} title="Next">
                    <i class="ph-fill ph-skip-forward"></i>
                  </button>
                  <div
                    class="volume-control-group"
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
                      class={
                        isVolumeHovered()
                          ? "volume-slider-wrapper hovered"
                          : "volume-slider-wrapper"
                      }
                    >
                      <input
                        class="custom-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted() ? 0 : volume()}
                        onInput={handleVolumeChange}
                        style={{ "--progress": `${volProgress()}%` } as any}
                      />
                    </div>
                  </div>
                  <span class="player-timecode">
                    {formatTime(currentTime())}{" "}
                    <span class="player-timecode-separator">/</span>{" "}
                    {formatTime(duration())}
                  </span>
                </div>

                <div class="flex-row-gap gap-4 relative">
                  <button
                    class={`control-btn ${autoplay() ? "active" : ""}`}
                    onClick={() => setAutoplay(!autoplay())}
                    title={
                      autoplay() ? "Autoplay On" : "Autoplay Off (Loop Video)"
                    }
                  >
                    <i
                      class={`ph-fill ph-${autoplay() ? "play-circle" : "repeat"}`}
                    ></i>
                  </button>

                  <div
                    class={`player-popup-menu ${showCCMenu() ? "visible" : ""}`}
                    ref={ccMenuRef}
                  >
                    <div class="player-popup-header">
                      <i class="ph-fill ph-closed-captioning"></i> Visibility
                    </div>
                    <button
                      class={`player-popup-item ${subtitlesEnabled() ? "selected" : ""}`}
                      onClick={toggleCC}
                    >
                      <span>English (Auto)</span>
                      <Show when={subtitlesEnabled()}>
                        <i class="ph-fill ph-check-circle"></i>
                      </Show>
                    </button>
                    <button
                      class={`player-popup-item ${!subtitlesEnabled() ? "selected" : ""}`}
                      onClick={toggleCC}
                    >
                      <span>Off</span>
                      <Show when={!subtitlesEnabled()}>
                        <i class="ph-fill ph-check-circle"></i>
                      </Show>
                    </button>

                    <div class="player-popup-header" style="margin-top: 8px;">
                      <i class="ph-fill ph-palette"></i> Customize
                    </div>
                    <div class="subtitle-customization-row">
                      <label>Color</label>
                      <input
                        type="color"
                        value={subColor()}
                        onInput={(e) => setSubColor(e.target.value)}
                      />
                    </div>
                    <div class="subtitle-customization-row">
                      <label>Background</label>
                      <select
                        value={subBg()}
                        onChange={(e) => setSubBg(e.target.value)}
                      >
                        <option value="rgba(0,0,0,0.8)">Dark</option>
                        <option value="transparent">Transparent</option>
                        <option value="rgba(255,255,255,0.8)">Light</option>
                      </select>
                    </div>
                    <div class="subtitle-customization-row">
                      <label>Size</label>
                      <select
                        value={subSize()}
                        onChange={(e) => setSubSize(e.target.value)}
                      >
                        <option value="14px">Small</option>
                        <option value="18px">Medium</option>
                        <option value="24px">Large</option>
                        <option value="32px">Extra Large</option>
                      </select>
                    </div>
                    <div class="subtitle-customization-row">
                      <label>Position</label>
                      <select
                        value={subPos()}
                        onChange={(e) => setSubPos(e.target.value)}
                      >
                        <option value="-20px">Bottom</option>
                        <option value="-35vh">Middle</option>
                        <option value="-75vh">Top</option>
                      </select>
                    </div>
                  </div>

                  <div
                    class={`player-popup-menu ${showSettingsMenu() ? "visible" : ""}`}
                    ref={settingsMenuRef}
                  >
                    <div class="player-popup-header">
                      <i class="ph-fill ph-gauge"></i> Speed
                    </div>
                    {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        class={`player-popup-item ${playbackRate() === rate ? "selected" : ""}`}
                        onClick={() => changeSpeed(rate)}
                      >
                        <span>{rate === 1.0 ? "Normal" : `${rate}x`}</span>
                        <Show when={playbackRate() === rate}>
                          <i class="ph-fill ph-check-circle"></i>
                        </Show>
                      </button>
                    ))}
                    <div class="player-popup-header" style="margin-top: 8px;">
                      <i class="ph-fill ph-nut"></i> Options
                    </div>
                    <button
                      class="player-popup-item"
                      onClick={() => {
                        togglePiP();
                        setShowSettingsMenu(false);
                      }}
                    >
                      <span>Picture in Picture</span>
                      <i class="ph-fill ph-picture-in-picture"></i>
                    </button>
                  </div>

                  <button
                    class={`control-btn ${subtitlesEnabled() ? "active" : ""}`}
                    title={
                      hasSubtitles() ? "Subtitles/CC" : "No Subtitles Available"
                    }
                    onClick={() => {
                      if (hasSubtitles()) {
                        setShowCCMenu(!showCCMenu());
                        setShowSettingsMenu(false);
                      }
                    }}
                    style={
                      !hasSubtitles()
                        ? { opacity: 0.3, cursor: "not-allowed" }
                        : {}
                    }
                  >
                    <i class="ph-fill ph-closed-captioning"></i>
                    <Show when={hasSubtitles() && !subtitlesEnabled()}>
                      <div
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          width: "6px",
                          height: "6px",
                          background: "var(--primary-accent)",
                          "border-radius": "50%",
                        }}
                      ></div>
                    </Show>
                  </button>

                  <button
                    class="control-btn"
                    title="Settings"
                    onClick={() => {
                      setShowSettingsMenu(!showSettingsMenu());
                      setShowCCMenu(false);
                    }}
                  >
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
            <h1 class="player-title">{video()!.title}</h1>
            <div class="flex-row-between player-meta-row">
              <div class="flex-row-gap">
                <img
                  src={convertFileSrc(video()!.avatar_path)}
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.className = "ph-fill ph-user avatar-small";
                  }}
                  class="avatar-small"
                />
                <div>
                  <h3
                    class="player-channel"
                    onClick={() => navigate(`/artist/${video()!.channel}`)}
                  >
                    {video()!.channel}
                  </h3>
                </div>
              </div>
              <button
                class={`clay-btn player-favorite-status ${isFavorite() ? "active" : ""}`}
                onClick={toggleFavoriteStatus}
              >
                <i
                  class={isFavorite() ? "ph-fill ph-heart" : "ph ph-heart"}
                ></i>
                {isFavorite() ? "Saved" : "Save"}
              </button>
            </div>

            <div
              class={`player-desc-box ${descExpanded() ? "expanded" : ""}`}
              onClick={() => {
                if (!descExpanded()) setDescExpanded(true);
              }}
            >
              <div class="desc-meta">
                <span>{formatTime(duration())} length</span>
                <span>•</span>
                <span>Local Hardware Library</span>
              </div>
              <div>{description()}</div>

              <Show when={descExpanded()}>
                <div
                  class="desc-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescExpanded(false);
                  }}
                >
                  Show less
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      <div class="player-sidebar">
        <h3 class="settings-title">Up next</h3>
        <For each={queue()}>
          {(qVideo) => (
            <div
              class="queue-item"
              onClick={() => navigate(`/player/${qVideo.id}`)}
            >
              <div class="queue-thumbnail-wrapper">
                <img
                  src={convertFileSrc(qVideo.thumbnail_path)}
                  class="queue-thumbnail"
                />
              </div>
              <div class="queue-meta">
                <span class="queue-title">{qVideo.title}</span>
                <span class="queue-channel">{qVideo.channel}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
