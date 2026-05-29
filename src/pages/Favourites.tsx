import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
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
    <div class="page-wrapper">
      <h2
        style={{
          "font-family": "var(--font-display)",
          "font-size": "28px",
          "margin-bottom": "30px",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <i
          class="ph-fill ph-heart"
          style={{ "font-size": "32px", color: "var(--primary-accent)" }}
        ></i>{" "}
        Favourites
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
                class="clay-card"
                onClick={() => navigate(`/player/${video.id}`)}
              >
                <img
                  src={`http://127.0.0.1:1422/Thumbnails/${video.id}.jpg`}
                  alt={video.title}
                  class="video-thumbnail"
                />
                <div class="video-info">
                  <h3 class="video-title">{video.title}</h3>
                  <p class="video-channel">{video.channel}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
