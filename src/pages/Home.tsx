import { createSignal, onMount, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from '@solidjs/router';

interface VideoEntry {
  id: string;
  title: string;
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
    <div>
      <h2>Downloaded Videos</h2>
      <div class="grid">
        <For each={videos()}>
          {(video) => (
            <div 
              class="video-card" 
              style={{ "flex-direction": "column", padding: "0", "align-items": "flex-start", background: "transparent" }} 
              onClick={() => navigate(`/player/${video.id}`)}
            >
              <img 
                src={`http://127.0.0.1:1422/Thumbnails/${video.id}.jpg`} 
                alt="thumbnail" 
                style={{ width: "100%", "aspect-ratio": "16/9", "object-fit": "cover", "border-radius": "10px" }} 
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="%23272727"/><text x="50%" y="50%" fill="%23aaaaaa" dominant-baseline="middle" text-anchor="middle">No Thumbnail</text></svg>';
                }}
              />
              <div style={{ padding: "10px 5px", width: "100%", "box-sizing": "border-box", "text-align": "left" }}>
                <h4 style={{ margin: "0", "font-size": "14px", "white-space": "nowrap", "overflow": "hidden", "text-overflow": "ellipsis" }}>
                  {video.title}
                </h4>
              </div>
            </div>
          )}
        </For>
        {videos().length === 0 && <p style={{color: "var(--yt-text-muted)"}}>No videos found. Go download some!</p>}
      </div>
    </div>
  );
}