import { createSignal, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import { invoke } from '@tauri-apps/api/core';

interface VideoEntry {
  id: string;
  title: string;
  video_path: string;
  thumbnail_path: string;
}

export default function Player() {
  const params = useParams();
  const [video, setVideo] = createSignal<VideoEntry | null>(null);

  onMount(async () => {
    try {
      const db = await invoke<VideoEntry[]>('get_downloaded_videos');
      const found = db.find(v => v.id === params.id);
      if (found) setVideo(found);
    } catch (e) {
      console.error("Could not load video", e);
    }
  });

  return (
    <div style={{ "max-width": "1280px", margin: "0 auto" }}>
      {video() ? (
        <>
          <video 
            controls 
            autoplay 
            preload="auto"
            style={{ width: "100%", "border-radius": "10px", "background": "black" }} 
          >
            {/* Directly hit the Warp HTTP Server. Bypasses Tauri asset:// bug */}
            <source src={`http://127.0.0.1:1422/Videos/${video()!.id}.mp4`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <h2 style={{ "margin-top": "15px" }}>{video()!.title}</h2>
        </>
      ) : (
        <p>Loading player...</p>
      )}
    </div>
  );
}