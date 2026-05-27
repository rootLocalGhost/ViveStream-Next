import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import Settings from "../pages/Settings";
import { vi } from "vitest";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(() => Promise.resolve(true)),
  message: vi.fn(() => Promise.resolve()),
}));

describe("Settings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles wipe dependencies", async () => {
    render(() => <Settings />);

    const wipeBtn = screen.getByText("Wipe Engines");
    expect(wipeBtn).toBeInTheDocument();

    fireEvent.click(wipeBtn);

    await waitFor(() => {
      expect(ask).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("wipe_dependencies");
      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("Dependencies wiped successfully"),
        expect.anything()
      );
    });
  });

  it("handles nuclear wipe", async () => {
    render(() => <Settings />);

    const nuclearBtn = screen.getByText("Nuclear Wipe");
    expect(nuclearBtn).toBeInTheDocument();

    fireEvent.click(nuclearBtn);

    await waitFor(() => {
      expect(ask).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("nuclear_wipe");
      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("Nuclear wipe complete"),
        expect.anything()
      );
    });
  });
});
