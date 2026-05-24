import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export default function Downloads() {
  const [url, setUrl] = createSignal('');
  const [quality, setQuality] = createSignal('1080p');
  const [progress, setProgress] = createSignal('');
  const [downloading, setDownloading] = createSignal(false);

  const startDownload = async () => {
    if (!url()) return;
    setDownloading(true);
    setProgress('Fetching video metadata...');

    try {
      const metadata = await invoke('get_video_metadata', { url: url() });
      setProgress(`Starting ${quality()} download with Intel QSV...`);

      const unlisten = await listen<string>('download-progress', (event) => {
        setProgress(event.payload); 
      });

      await invoke('download_video', { url: url(), metadata, quality: quality() });
      setProgress('Download and hardware transcoding complete!');
      unlisten();
    } catch (e) {
      setProgress(`Error: ${e}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h2>Download Video</h2>
      <div style={{ display: "flex", gap: "10px", "margin-bottom": "20px", "align-items": "center" }}>
        <input 
          type="text" 
          class="input-field" 
          placeholder="Paste YouTube URL here..." 
          value={url()}
          onInput={(e) => setUrl(e.target.value)}
        />
        <select 
          value={quality()} 
          onChange={(e) => setQuality(e.target.value)}
          style={{ padding: "10px", "border-radius": "10px", background: "#121212", color: "white", border: "1px solid var(--yt-border)" }}
        >
          <option value="1080p">1080p</option>
          <option value="4K">4K</option>
        </select>
        <button class="btn btn-primary" onClick={startDownload} disabled={downloading()}>
          {downloading() ? 'Downloading...' : 'Download'}
        </button>
      </div>
      
      <div style={{ background: "#181818", padding: "15px", "border-radius": "10px", "font-family": "monospace" }}>
        {progress() || "Waiting for download to start..."}
      </div>
    </div>
  );
}