import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate } from "@solidjs/router";
import { VideoEntry } from "../store";
import "./ArtistPage.css";

export default function ArtistPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = createSignal<VideoEntry[]>([]);

  onMount(async () => {
    try {
      const data = await invoke<VideoEntry[]>("get_videos_by_artist", {
        name: params.name,
      });
      setVideos(data);
    } catch (e) {
      console.error("Failed to load artist videos:", e);
    }
  });

  return (
    <div class="page-wrapper artist-page">
      <div class="clay-card flex-row-gap artist-hero-card">
        <img
          src={`http://127.0.0.1:1422/Avatars/${params.name}.jpg`}
          onError={(e) => {
            e.currentTarget.src = "";
            e.currentTarget.className = "ph-fill ph-user avatar-large";
          }}
          class="avatar-large artist-avatar"
        />
        <div>
          <h2 class="page-title artist-header-title">{params.name}</h2>
          <span class="settings-desc">
            {videos().length} Video{videos().length !== 1 && "s"}
          </span>
        </div>
      </div>

      <div class="grid">
        <For each={videos()}>
          {(video) => (
            <div
              class="video-card"
              onClick={() => navigate(`/player/${video.id}`)}
            >
              <img
                src={`http://127.0.0.1:1422/Thumbnails/${video.id}.jpg`}
                alt={video.title}
                class="video-thumbnail"
              />
              <div class="video-info">
                <div class="video-text-content">
                  <h3 class="video-title">{video.title}</h3>
                  <p class="video-channel">{video.channel}</p>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
