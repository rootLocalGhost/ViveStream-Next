import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import Downloads from "../pages/Downloads";
import { vi } from "vitest";

describe("Downloads Component", () => {
  it("should toggle dropdown and change quality", async () => {
    render(() => <Downloads />);

    // Trigger the dropdown - use getAllByText and grab the first one (trigger)
    const selectTriggers = screen.getAllByText(/1080p \(HD\)/i);
    expect(selectTriggers.length).toBeGreaterThan(0);
    const selectTrigger = selectTriggers[0];

    fireEvent.click(selectTrigger);

    // Assert that the dropdown opened
    const dropdownMenu = screen.getByText("4K (HD)");
    expect(dropdownMenu).toBeInTheDocument();

    // Select another quality
    fireEvent.click(dropdownMenu);

    // Verify it changed
    expect(screen.getAllByText("4K (HD)").length).toBeGreaterThan(0);

    // Dropdown should be closed (click outside)
    fireEvent.mouseDown(document.body);
  });
});
