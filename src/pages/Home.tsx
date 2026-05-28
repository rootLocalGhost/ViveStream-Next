import { onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import { homeVideos, setHomeVideos } from "../store";

export default function Home() {
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const data = await invoke<any[]>("get_downloaded_videos");
      setHomeVideos(data);
    } catch (e) {
      console.error("Failed to load library:", e);
    }
  });

  return (
    <div class="page-wrapper">
      {homeVideos().length === 0 ? (
        <PremiumPlaceholder
          title="No Media Found"
          subtitle="Your local library is currently empty. Head over to the Downloads tab to start building your offline collection."
          iconName="film-strip"
        />
      ) : (
        <div class="grid">
          <For each={homeVideos()}>
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
