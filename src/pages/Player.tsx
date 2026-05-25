import { createSignal, onMount, createEffect } from 'solid-js';
import { useParams } from '@solidjs/router';
import { invoke } from '@tauri-apps/api/core';

interface VideoEntry {
  id: string;
  title: string;
  channel: string;
  video_path: string;
  thumbnail_path: string;
}

export default function Player() {
  const params = useParams();
  const [video, setVideo] = createSignal<VideoEntry | null>(null);
  let videoRef: HTMLVideoElement | undefined;

  onMount(async () => {
    try {
      const db = await invoke<VideoEntry[]>('get_downloaded_videos');
      const found = db.find(v => v.id === params.id);
      if (found) setVideo(found);
    } catch (e) {
      console.error("Could not load video", e);
    }
  });

  // Force auto-play when the video source is loaded
  createEffect(() => {
    if (video() && videoRef) {
      videoRef.play().catch(e => console.log("Autoplay blocked by browser policy:", e));
    }
  });

  return (
    <div style={{ "max-width": "1280px", margin: "0 auto", padding: "20px" }}>
      {video() ? (
        <>
          <video 
            ref={videoRef}
            controls 
            autoplay 
            preload="auto"
            style={{ width: "100%", "border-radius": "12px", "background": "black", "box-shadow": "0 10px 30px rgba(0,0,0,0.5)" }} 
          >
            <source src={`http://127.0.0.1:1422/Videos/${video()!.id}.mp4`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <h2 style={{ "margin-top": "20px", "font-family": "var(--font-body)" }}>{video()!.title}</h2>
          <p style={{ "color": "var(--secondary-text)" }}>{video()!.channel}</p>
        </>
      ) : (
        <p>Loading player...</p>
      )}
    </div>
  );
}