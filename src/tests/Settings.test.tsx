import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import Settings from "../pages/Settings";
import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { showConfirmDialog, addToast } from "../store";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

// Partially mock the store to override only the dialog and toast functions
// This ensures all the SolidJS signals in the store remain fully reactive
vi.mock("../store", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    showConfirmDialog: vi.fn(() => Promise.resolve(true)),
    addToast: vi.fn(),
  };
});

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
      expect(showConfirmDialog).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("wipe_dependencies");
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining("Dependencies wiped successfully"),
        expect.anything(),
      );
    });
  });

  it("handles nuclear wipe", async () => {
    render(() => <Settings />);
    const nuclearBtn = screen.getByText("Delete Media & Database");
    expect(nuclearBtn).toBeInTheDocument();
    fireEvent.click(nuclearBtn);

    await waitFor(() => {
      expect(showConfirmDialog).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("nuclear_wipe");
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining("Nuclear wipe complete"),
        expect.anything(),
      );
    });
  });

  it("handles clean database", async () => {
    render(() => <Settings />);
    const cleanBtn = screen.getByText("Clean Data");
    expect(cleanBtn).toBeInTheDocument();
    fireEvent.click(cleanBtn);

    await waitFor(() => {
      expect(showConfirmDialog).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("clean_database_and_media");
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining(
          "Database and media have been successfully cleaned",
        ),
        expect.anything(),
      );
    });
  });

  it("handles engine updates", async () => {
    render(() => <Settings />);
    const updateBtn = screen.getByText("Update Engines");
    expect(updateBtn).toBeInTheDocument();
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_binaries");
      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining("successfully updated"),
        expect.anything(),
      );
    });
  });
});
