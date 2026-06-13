import { render, screen, waitFor } from "@solidjs/testing-library";
import Player from "../pages/Player";
import { vi } from "vitest";

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
          avatar_path: "/mock/avatar.jpg",
          subtitle_path: "/mock/sub.vtt",
          desc_path: "/mock/desc.txt",
        },
      ]);
    }
    if (cmd === "check_favorite") {
      return Promise.resolve(false);
    }
    return Promise.resolve();
  }),
  convertFileSrc: vi.fn((path) => `asset://${path}`),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "video123" }),
  useNavigate: () => vi.fn(),
}));

beforeAll(() => {
  HTMLVideoElement.prototype.play = vi.fn().mockReturnValue(Promise.resolve());
  HTMLVideoElement.prototype.pause = vi.fn();
  HTMLVideoElement.prototype.load = vi.fn();
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve("Mock fetched data"),
    }),
  ) as any;
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
