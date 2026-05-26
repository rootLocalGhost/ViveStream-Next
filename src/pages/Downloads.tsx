import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export default function Downloads() {
  const [url, setUrl] = createSignal("");
  const [quality, setQuality] = createSignal("1080p");
  const [progress, setProgress] = createSignal("");
  const [downloading, setDownloading] = createSignal(false);

  const startDownload = async () => {
    if (!url()) return;
    setDownloading(true);
    setProgress("Fetching video metadata...");

    try {
      const metadata = await invoke("get_video_metadata", { url: url() });
      setProgress(`Starting ${quality()} download with Intel QSV...`);

      const unlisten = await listen<string>("download-progress", (event) => {
        setProgress(event.payload);
      });

      await invoke("download_video", {
        url: url(),
        metadata,
        quality: quality(),
      });

      setProgress("Download and hardware transcoding complete!");
      unlisten();
    } catch (e) {
      setProgress(`Error: ${e}`);
    } finally {
      setDownloading(false);
      setUrl(""); // Clear input on finish
    }
  };

  return (
    <div style={{ padding: "40px", "max-width": "800px" }}>
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
          class="ph-fill ph-download-simple"
          style={{ "font-size": "32px", color: "var(--primary-accent)" }}
        ></i>{" "}
        Fetch Stream
      </h2>

      <div
        style={{
          background: "var(--secondary-background)",
          padding: "30px",
          "border-radius": "16px",
          border: "1px solid var(--border-color)",
          "box-shadow": "var(--shadow-color-heavy)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "15px",
            "align-items": "center",
            "flex-wrap": "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Paste YouTube URL here..."
            value={url()}
            onInput={(e) => setUrl(e.target.value)}
            style={{
              flex: "1",
              padding: "15px 20px",
              "border-radius": "12px",
              background: "var(--tertiary-background)",
              color: "white",
              border: "1px solid var(--border-color)",
              outline: "none",
              "font-family": "var(--font-body)",
            }}
          />
          <select
            value={quality()}
            onChange={(e) => setQuality(e.target.value)}
            style={{
              padding: "15px",
              "border-radius": "12px",
              background: "var(--tertiary-background)",
              color: "white",
              border: "1px solid var(--border-color)",
              outline: "none",
              cursor: "pointer",
              "font-family": "var(--font-body)",
            }}
          >
            <option value="720p">720p (HD)</option>
            <option value="1080p">1080p (FHD)</option>
            <option value="1440p">1440p (2K)</option>
            <option value="4K">2160p (4K)</option>
            <option value="Best">Best Available</option>
          </select>
          <button
            onClick={startDownload}
            disabled={downloading() || !url()}
            style={{
              background: "var(--primary-accent)",
              color: "white",
              border: "none",
              padding: "15px 30px",
              "border-radius": "12px",
              cursor: downloading() || !url() ? "not-allowed" : "pointer",
              "font-weight": "bold",
              display: "flex",
              "align-items": "center",
              gap: "10px",
              opacity: downloading() || !url() ? "0.5" : "1",
              transition: "background 0.2s",
            }}
          >
            <i
              class="ph-fill ph-download-simple"
              style={{ "font-size": "20px" }}
            ></i>
            {downloading() ? "Processing..." : "Download"}
          </button>
        </div>

        <div
          style={{
            "margin-top": "30px",
            background: "#0a0a0a",
            padding: "20px",
            "border-radius": "12px",
            "font-family": "monospace",
            color: "var(--primary-text)",
            "min-height": "80px",
            border: "1px solid var(--border-color)",
            "white-space": "pre-wrap",
            "word-break": "break-all",
          }}
        >
          {progress() || (
            <span style={{ color: "var(--secondary-text)" }}>
              Waiting for URL...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
