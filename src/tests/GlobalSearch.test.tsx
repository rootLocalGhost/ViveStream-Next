import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import GlobalSearch from "../components/GlobalSearch";
import { vi } from "vitest";
import {
  setGlobalSearchQuery,
  setIsSearchOpen,
  isSearchOpen,
  toggleAlwaysShowSearchBar,
  alwaysShowSearchBar,
} from "../store";

const mockNavigate = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "get_downloaded_videos") {
      return Promise.resolve([
        {
          id: "vid1",
          title: "Awesome Song",
          channel: "Star Artist",
          video_path: "/vids/1.mp4",
          thumbnail_path: "/thumbs/1.jpg",
          avatar_path: "/avatars/artist.jpg",
          subtitle_path: "",
          desc_path: "",
        },
      ]);
    }
    if (cmd === "get_playlists") {
      return Promise.resolve([
        { id: "pl1", name: "Summer Vibes", created_at: "2026-01-01" },
      ]);
    }
    if (cmd === "get_artists") {
      return Promise.resolve([
        { name: "Star Artist", avatar_path: "/avatars/artist.jpg" },
      ]);
    }
    return Promise.resolve([]);
  }),
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => mockNavigate,
}));

describe("GlobalSearch Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGlobalSearchQuery("");
    setIsSearchOpen(false);
    toggleAlwaysShowSearchBar(false);
  });

  it("opens spotlight modal when search is active in auto-hide mode", () => {
    setIsSearchOpen(true);
    render(() => <GlobalSearch />);
    expect(screen.getByPlaceholderText(/search all library/i)).toBeInTheDocument();
  });

  it("filters items when query is entered in spotlight input", async () => {
    setIsSearchOpen(true);
    render(() => <GlobalSearch />);
    const input = screen.getByPlaceholderText(/search all library/i);

    fireEvent.input(input, { target: { value: "Awesome" } });

    await waitFor(() => {
      expect(screen.getByText("Awesome Song")).toBeInTheDocument();
      expect(screen.getByText("Star Artist")).toBeInTheDocument();
    });
  });

  it("renders floating search bar in the top-middle when alwaysShowSearchBar is enabled", async () => {
    toggleAlwaysShowSearchBar(true);
    const { container } = render(() => <GlobalSearch />);
    expect(alwaysShowSearchBar()).toBe(true);

    const floatingContainer = container.querySelector(".floating-search-container");
    expect(floatingContainer).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/search all library/i);
    expect(input).toBeInTheDocument();
  });

  it("handles keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)", async () => {
    setIsSearchOpen(true);
    render(() => <GlobalSearch />);
    const input = screen.getByPlaceholderText(/search all library/i);

    fireEvent.input(input, { target: { value: "Awesome" } });

    await waitFor(() => {
      expect(screen.getByText("Awesome Song")).toBeInTheDocument();
    });

    // ArrowDown
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // ArrowUp
    fireEvent.keyDown(input, { key: "ArrowUp" });
    // Enter to navigate
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/player/vid1");

    // Escape closes
    fireEvent.keyDown(input, { key: "Escape" });
    expect(isSearchOpen()).toBe(false);
  });

  it("allows clearing the search query via clear button", async () => {
    setIsSearchOpen(true);
    render(() => <GlobalSearch />);
    const input = screen.getByPlaceholderText(/search all library/i);

    fireEvent.input(input, { target: { value: "Awesome" } });
    await waitFor(() => {
      expect(screen.getByTitle("Clear search")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Clear search"));
    expect(input).toHaveValue("");
  });
});
