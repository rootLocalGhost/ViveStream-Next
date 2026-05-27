import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import Downloads from "../pages/Downloads";

// Create a test file for Tauri IPC mocking to explicitly verify
// that calling `download_video` correctly passes the `VideoEntry` struct.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd, args) => {
    if (cmd === "get_video_metadata") {
      return Promise.resolve({
        id: "mock_id_123",
        title: "Mock Video Title",
        channel: "Mock Channel",
        video_path: "/mock/videos/mock_id_123.mp4",
        thumbnail_path: "/mock/thumbs/mock_id_123.jpg",
      });
    }
    if (cmd === "download_video") {
      return Promise.resolve();
    }
    return Promise.resolve();
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("Tauri IPC Mocking (Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call download_video with correctly parsed VideoEntry struct", async () => {
    render(() => <Downloads />);

    // Enter URL
    const input = screen.getByPlaceholderText("Paste YouTube URL here...");
    fireEvent.input(input, {
      target: { value: "https://youtube.com/watch?v=mock_id_123" },
    });

    // Click download
    const downloadBtn = screen.getByText("Download");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      // First it fetches metadata
      expect(invoke).toHaveBeenCalledWith("get_video_metadata", {
        url: "https://youtube.com/watch?v=mock_id_123",
      });

      // Then it triggers download_video with the parsed VideoEntry struct metadata
      expect(invoke).toHaveBeenCalledWith("download_video", {
        url: "https://youtube.com/watch?v=mock_id_123",
        metadata: {
          id: "mock_id_123",
          title: "Mock Video Title",
          channel: "Mock Channel",
          video_path: "/mock/videos/mock_id_123.mp4",
          thumbnail_path: "/mock/thumbs/mock_id_123.jpg",
        },
        quality: "1080p", // default quality
      });
    });
  });
});
