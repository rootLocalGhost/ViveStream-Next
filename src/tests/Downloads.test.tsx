import { render, screen, fireEvent } from "@solidjs/testing-library";
import Downloads from "../pages/Downloads";

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
});
