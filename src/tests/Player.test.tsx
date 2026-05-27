import { render, screen, waitFor } from "@solidjs/testing-library";
import Player from "../pages/Player";
import { vi } from "vitest";

// Mock Tauri Core IPC
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd) => {
    if (cmd === "get_downloaded_videos") {
      return Promise.resolve([
        {
          id: "video123",
          title: "Test Video",
          channel: "Test Channel",
          video_path: "/mock/video.mp4",
          thumbnail_path: "/mock/thumb.jpg",
        },
      ]);
    }
    return Promise.resolve();
  }),
}));

// Mock Tauri Event Listeners (OS Media Keys)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock SolidJS Router (Prevents <A> and 'use' invariant errors)
vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "video123" }),
  useNavigate: () => vi.fn(),
}));

beforeAll(() => {
  HTMLVideoElement.prototype.play = vi.fn().mockReturnValue(Promise.resolve());
  HTMLVideoElement.prototype.pause = vi.fn();
});

describe("Player Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load and display video info", async () => {
    render(() => <Player />);

    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
      expect(screen.getByText("Test Channel")).toBeInTheDocument();
    });

    const videoElement = document.querySelector("video");
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).toHaveAttribute(
      "src",
      "http://127.0.0.1:1422/Videos/video123.mp4",
    );
  });
});
