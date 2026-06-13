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
  const [isLooping, setIsLooping] = createSignal(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = createSignal(false);

  let videoRef: HTMLVideoElement | undefined;
  let playerContainerRef: HTMLDivElement | undefined;
  let settingsMenuRef: HTMLDivElement | undefined;
  let ccMenuRef: HTMLDivElement | undefined;
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
        setDescExpanded(false);
        setSubtitlesEnabled(false);

        const favStatus = await invoke<boolean>("check_favorite", {
          id: targetId,
        });
        setIsFavorite(favStatus);

        try {
          const descRes = await fetch(
            `http://127.0.0.1:1422/Descriptions/${targetId}.txt`,
          );
          if (descRes.ok) {
            setDescription(await descRes.text());
          } else {
            setDescription("No description available.");
          }
        } catch {
          setDescription("No description available.");
        }

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
    if (isLooping() && videoRef) {
      videoRef.currentTime = 0;
      handlePlay();
      return;
    }
    const nextVideo = queue()[0];
    if (nextVideo) navigate(`/player/${nextVideo.id}`);
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  const playPrev = async () => {
    if (!video()) return;
    try {
      const db = await invoke<VideoEntry[]>("get_downloaded_videos");
      const currentIndex = db.findIndex((v) => v.id === video()!.id);
      if (currentIndex > 0) {
        navigate(`/player/${db[currentIndex - 1].id}`);
      } else if (db.length > 0) {
        navigate(`/player/${db[db.length - 1].id}`);
      }
    } catch (e) {
      console.error("Failed to navigate to previous video:", e);
    }
  };

  const playNext = () => {
    const nextVideo = queue()[0];
    if (nextVideo) navigate(`/player/${nextVideo.id}`);
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
    setShowCCMenu(false);
  };

  const changeSpeed = (rate: number) => {
    if (videoRef) {
      videoRef.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettingsMenu(false);
  };

  onMount(async () => {
    await loadVideoData(params.id);
    unlistenPlay = await listen("media-play", () => handlePlay());
    unlistenPause = await listen("media-pause", () => handlePause());
    unlistenNext = await listen("media-next", () => handleVideoEnd());
    unlistenPrev = await listen("media-prev", () => {
      if (videoRef) videoRef.currentTime = 0;
    });
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef && !settingsMenuRef.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (ccMenuRef && !ccMenuRef.contains(e.target as Node)) {
        setShowCCMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

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
      invoke("update_media_metadata", {
        title: video()!.title,
        artist: video()!.channel,
      });
      videoRef.currentTime = 0;
      videoRef.volume = volume();
      videoRef.muted = isMuted();
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
              src={`http://127.0.0.1:1422/Videos/${video()!.id}.mp4`}
            >
              <track
                kind="captions"
                src={`http://127.0.0.1:1422/Videos/${video()!.id}.vtt`}
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
                  <div
                    class={`player-popup-menu ${showCCMenu() ? "visible" : ""}`}
                    ref={ccMenuRef}
                  >
                    <div class="player-popup-header">
                      <i class="ph-fill ph-closed-captioning"></i> Subtitles
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
                      class={`player-popup-item ${isLooping() ? "selected" : ""}`}
                      onClick={() => {
                        setIsLooping(!isLooping());
                        setShowSettingsMenu(false);
                      }}
                    >
                      <span>Loop Video</span>
                      <i
                        class={`ph-fill ph-toggle-${isLooping() ? "right" : "left"}`}
                      ></i>
                    </button>
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
                    title="Subtitles/CC"
                    onClick={() => {
                      setShowCCMenu(!showCCMenu());
                      setShowSettingsMenu(false);
                    }}
                  >
                    <i class="ph-fill ph-closed-captioning"></i>
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
                  src={`http://127.0.0.1:1422/Avatars/${video()!.channel}.jpg`}
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
                  src={`http://127.0.0.1:1422/Thumbnails/${qVideo.id}.jpg`}
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
