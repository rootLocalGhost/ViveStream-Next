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
  useSearchParams: () => [{}],
}));

beforeAll(() => {
  HTMLVideoElement.prototype.play = vi.fn().mockReturnValue(Promise.resolve());
  HTMLVideoElement.prototype.pause = vi.fn();
  HTMLVideoElement.prototype.load = vi.fn();
  HTMLVideoElement.prototype.requestPictureInPicture = vi
    .fn()
    .mockResolvedValue({} as any);
  document.exitPictureInPicture = vi.fn().mockResolvedValue({} as any);
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

  it("should preserve playback state on unmount for miniplayer persistence", async () => {
    const { unmount } = render(() => <Player />);

    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
    });

    const videoElement = document.querySelector("video");
    expect(videoElement).toBeInTheDocument();

    unmount();

    // In store, activeVideo is preserved so miniplayer continues
    const { activeVideo, closeGlobalMiniplayer } = await import("../store");
    expect(activeVideo()).not.toBeNull();
    expect(activeVideo()?.title).toBe("Test Video");

    // Closing miniplayer pauses and clears active video
    closeGlobalMiniplayer();
    expect(activeVideo()).toBeNull();
  });

  it("does not toggle fullscreen when Ctrl+F or Cmd+F is pressed", async () => {
    const { container } = render(() => <Player />);
    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
    });

    const playerContainer = container.querySelector(".player-video-wrapper");
    const requestFullscreenMock = vi.fn();
    if (playerContainer) {
      playerContainer.requestFullscreen = requestFullscreenMock;
    }

    // Fire Ctrl + F
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true })
    );
    expect(requestFullscreenMock).not.toHaveBeenCalled();

    // Fire Meta + F (Cmd + F)
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F", metaKey: true, bubbles: true })
    );
    expect(requestFullscreenMock).not.toHaveBeenCalled();
  });

  it("handles queue advance in-place for activeVideo and playerQueue", async () => {
    const { setActiveVideo, setPlayerQueue, activeVideo, playerQueue } = await import("../store");
    const vid1 = {
      id: "vid1",
      title: "Video 1",
      channel: "Channel 1",
      video_path: "/mock/v1.mp4",
      thumbnail_path: "",
      avatar_path: "",
      subtitle_path: "",
      desc_path: "",
    };
    const vid2 = {
      id: "vid2",
      title: "Video 2",
      channel: "Channel 2",
      video_path: "/mock/v2.mp4",
      thumbnail_path: "",
      avatar_path: "",
      subtitle_path: "",
      desc_path: "",
    };

    setActiveVideo(vid1);
    setPlayerQueue([vid2]);

    expect(activeVideo()?.id).toBe("vid1");
    expect(playerQueue().length).toBe(1);

    // Simulate in-place miniplayer next
    const nextVid = playerQueue()[0];
    setPlayerQueue(playerQueue().slice(1));
    setActiveVideo(nextVid);

    expect(activeVideo()?.id).toBe("vid2");
    expect(playerQueue().length).toBe(0);
  });

  it("renders ambient lighting glow layer and action buttons correctly", async () => {
    const { container } = render(() => <Player />);
    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
    });

    const ambientGlow = container.querySelector(".player-ambient-glow");
    expect(ambientGlow).toBeInTheDocument();

    const addToPlaylistBtn = screen.getByText("Add to Playlist");
    expect(addToPlaylistBtn).toBeInTheDocument();

    const favouriteBtn = screen.getByText("Favourite");
    expect(favouriteBtn).toBeInTheDocument();
  });

  it("supports switching between dynamic and static ambient glow modes", async () => {
    const { togglePlayerAmbientType } = await import("../store");
    togglePlayerAmbientType("static");

    const { container } = render(() => <Player />);
    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
    });

    const ambientGlow = container.querySelector(".player-ambient-glow");
    expect(ambientGlow).toBeInTheDocument();

    // Reset back to dynamic
    togglePlayerAmbientType("dynamic");
  });
});
