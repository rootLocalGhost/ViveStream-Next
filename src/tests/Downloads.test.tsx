import { render, screen, fireEvent } from "@solidjs/testing-library";
import { vi } from "vitest";
import Downloads from "../pages/Downloads";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd) => {
    if (cmd === "get_download_history") {
      return Promise.resolve([]);
    }
    return Promise.resolve();
  }),
  convertFileSrc: vi.fn((path) => `asset://${path}`),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("Downloads Component", () => {
  it("should toggle dropdown and change quality", async () => {
    render(() => <Downloads />);

    // Default quality from store is 1440p
    const selectTriggers = screen.getAllByText(/1440p/i);
    expect(selectTriggers.length).toBeGreaterThan(0);

    const selectTrigger = selectTriggers[0];
    fireEvent.click(selectTrigger);

    const dropdownMenu = screen.getByText("4K");
    expect(dropdownMenu).toBeInTheDocument();

    fireEvent.click(dropdownMenu);
    expect(screen.getAllByText("4K").length).toBeGreaterThan(0);

    fireEvent.mouseDown(document.body);
  });

  it("should switch between Active Queue and History tabs", async () => {
    render(() => <Downloads />);

    const historyTabBtn = screen.getByRole("button", { name: /History/i });
    expect(historyTabBtn).toBeInTheDocument();

    fireEvent.click(historyTabBtn);
    expect(screen.getByText(/No download history yet/i)).toBeInTheDocument();

    const queueTabBtn = screen.getByRole("button", { name: /Active Queue/i });
    fireEvent.click(queueTabBtn);
    expect(
      screen.getByText(/Your download queue is empty/i),
    ).toBeInTheDocument();
  });
});
