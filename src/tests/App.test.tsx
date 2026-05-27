import { render, screen, waitFor } from "@solidjs/testing-library";
import App from "../App";
import { vi } from "vitest";

// Mock tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd) => {
    if (cmd === "check_binaries") {
      return Promise.resolve({ ytdlp_exists: true, ffmpeg_exists: true });
    }
    if (cmd === "get_downloaded_videos") {
      return Promise.resolve([]);
    }
    return Promise.resolve();
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  })),
}));

describe("App", () => {
  it("renders the main app and sidebar", async () => {
    render(() => <App />);

    // Wait for the app to initialize
    await waitFor(() => {
      expect(screen.getByText("ViveStream")).toBeInTheDocument();
    });

    // Check that sidebar is present
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
