import { render, screen, waitFor } from "@solidjs/testing-library";
import { Router, Route } from "@solidjs/router";
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
        },
      ]);
    }
    return Promise.resolve();
  }),
}));

beforeAll(() => {
  HTMLVideoElement.prototype.play = vi.fn().mockReturnValue(Promise.resolve());
});

describe("Player Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load and display video info", async () => {
    // To properly test Solid Router components that use useParams, we can mock the router
    // or just pass a simple wrapper. Let's mock the module.
    vi.mock("@solidjs/router", async () => {
      const actual = await vi.importActual("@solidjs/router");
      return {
        ...actual,
        useParams: () => ({ id: "video123" }),
      };
    });

    render(() => <Player />);

    await waitFor(() => {
      expect(screen.getByText("Test Video")).toBeInTheDocument();
      expect(screen.getByText("Test Channel")).toBeInTheDocument();
    });

    const videoElement = document.querySelector("video");
    expect(videoElement).toBeInTheDocument();

    const sourceElement = document.querySelector("source");
    expect(sourceElement).toHaveAttribute(
      "src",
      "http://127.0.0.1:1422/Videos/video123.mp4",
    );
  });
});
