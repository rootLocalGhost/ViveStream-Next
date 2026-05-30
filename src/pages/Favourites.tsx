import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import "./Favourites.css";
import { VideoEntry } from "../store";

export default function Favourites() {
  const [videos, setVideos] = createSignal<VideoEntry[]>([]);
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const data = await invoke<VideoEntry[]>("get_favorites");
      setVideos(data);
    } catch (e) {
      console.error("Failed to load favorites library:", e);
    }
  });

  return (
    <div class="page-wrapper favourites-page">
      <h2 class="page-title">
        <i class="ph-fill ph-heart"></i> Favourites
      </h2>

      {videos().length === 0 ? (
        <PremiumPlaceholder
          title="No Favourites Found"
          subtitle="You haven't added any media to your favourites yet. Play a video to add it here."
          iconName="heart"
        />
      ) : (
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
                  <img
                    src={`http://127.0.0.1:1422/Avatars/${video.channel}.jpg`}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    class="avatar-small"
                  />
                  <div class="video-text-content">
                    <h3 class="video-title">{video.title}</h3>
                    <p class="video-channel">{video.channel}</p>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
