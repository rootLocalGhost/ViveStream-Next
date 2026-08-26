import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import SortBar from "../components/SortBar";
import { SortOption } from "../utils/sortUtils";

describe("SortBar Component", () => {
  const options: SortOption[] = [
    { key: "date", label: "Date Added", icon: "ph-calendar-blank" },
    { key: "name", label: "Title (A-Z)", icon: "ph-text-aa" },
    { key: "channel", label: "Channel", icon: "ph-user" },
    { key: "random", label: "Random Shuffle", icon: "ph-shuffle" },
  ];

  it("renders correctly with current sort label", () => {
    const { getByText } = render(() => (
      <SortBar
        options={options}
        currentSort="date"
        currentDirection="desc"
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        itemCount={42}
      />
    ));

    expect(getByText("Date Added")).toBeDefined();
    expect(getByText("42")).toBeDefined();
    expect(getByText("Desc")).toBeDefined();
  });

  it("toggles dropdown and calls onSortChange when option is clicked", () => {
    const handleSortChange = vi.fn();
    const { getByText, getByTitle } = render(() => (
      <SortBar
        options={options}
        currentSort="date"
        currentDirection="desc"
        onSortChange={handleSortChange}
        onDirectionToggle={() => {}}
      />
    ));

    const trigger = getByTitle("Change sorting criterion");
    fireEvent.click(trigger);

    const titleOption = getByText("Title (A-Z)");
    expect(titleOption).toBeDefined();
    fireEvent.click(titleOption);

    expect(handleSortChange).toHaveBeenCalledWith("name");
  });

  it("calls onDirectionToggle when direction button is clicked", () => {
    const handleDirectionToggle = vi.fn();
    const { getByTitle } = render(() => (
      <SortBar
        options={options}
        currentSort="date"
        currentDirection="asc"
        onSortChange={() => {}}
        onDirectionToggle={handleDirectionToggle}
      />
    ));

    const dirBtn = getByTitle("Ascending order (Click to switch to Descending)");
    fireEvent.click(dirBtn);

    expect(handleDirectionToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onReshuffle when shuffle button is clicked", () => {
    const handleReshuffle = vi.fn();
    const { getByTitle } = render(() => (
      <SortBar
        options={options}
        currentSort="random"
        currentDirection="desc"
        onSortChange={() => {}}
        onDirectionToggle={() => {}}
        onReshuffle={handleReshuffle}
      />
    ));

    const shuffleBtn = getByTitle("Reshuffle random order");
    fireEvent.click(shuffleBtn);

    expect(handleReshuffle).toHaveBeenCalledTimes(1);
  });
});
