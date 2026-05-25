import { createSignal, onMount, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from '@solidjs/router';

interface VideoEntry {
  id: string;
  title: string;
  channel: string;
  video_path: string;
  thumbnail_path: string;
}

export default function Home() {
  const [videos, setVideos] = createSignal<VideoEntry[]>([]);
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const vids = await invoke<VideoEntry[]>('get_downloaded_videos');
      setVideos(vids);
    } catch (e) {
      console.error("Failed to load DB", e);
    }
  });

  return (
    <div style={{ padding: "20px" }}>
      <div class="grid">
        <For each={videos()}>
          {(video) => (
            <div class="video-card" onClick={() => navigate(`/player/${video.id}`)}>
              <img 
                src={`http://127.0.0.1:1422/Thumbnails/${video.id}.jpg`} 
                alt="thumbnail" 
                class="video-thumbnail"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="%232c2c2c"/><text x="50%" y="50%" fill="%23a0a0a0" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif">No Thumbnail</text></svg>';
                }}
              />
              <div class="video-info">
                <h4 class="video-title" title={video.title}>{video.title}</h4>
                <p class="video-channel">{video.channel}</p>
              </div>
            </div>
          )}
        </For>
        {videos().length === 0 && <p style={{color: "var(--secondary-text)"}}>No videos found. Go download some!</p>}
      </div>
    </div>
  );
}