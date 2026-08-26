import { createSignal, onMount, onCleanup, For, Show, createMemo } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  alwaysShowSortBar,
  isSortOpen,
  setIsSortOpen,
  homeSortBy,
  setHomeSortBy,
  homeSortDirection,
  setHomeSortDirection,
  setHomeRandomSeed,
  favSortBy,
  setFavSortBy,
  favSortDirection,
  setFavSortDirection,
  setFavRandomSeed,
  playlistsSortBy,
  setPlaylistsSortBy,
  playlistsSortDirection,
  setPlaylistsSortDirection,
  playlistVideosSortBy,
  setPlaylistVideosSortBy,
  playlistVideosSortDirection,
  setPlaylistVideosSortDirection,
  setPlaylistVideosRandomSeed,
  activePlaylistDetail,
  artistsSortBy,
  setArtistsSortBy,
  artistsSortDirection,
  setArtistsSortDirection,
  artistVideosSortBy,
  setArtistVideosSortBy,
  artistVideosSortDirection,
  setArtistVideosSortDirection,
  setArtistVideosRandomSeed,
  historySortBy,
  setHistorySortBy,
  historySortDirection,
  setHistorySortDirection,
} from "../store";
import { SortDirection, SortOption } from "../utils/sortUtils";
import "./FloatingSortBar.css";

export default function FloatingSortBar() {
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const currentPath = () => {
    try {
      return useLocation().pathname;
    } catch {
      return typeof window !== "undefined"
        ? window.location.pathname || "/"
        : "/";
    }
  };

  // Determine active sort configuration based on current route
  const activeConfig = createMemo(() => {
    const path = currentPath();

    if (path.startsWith("/player") || path.startsWith("/settings")) {
      return null;
    }

    if (path === "/") {
      const options: SortOption[] = [
        { key: "date", label: "Date Added", icon: "ph-calendar-blank" },
        { key: "name", label: "Title (A-Z)", icon: "ph-text-aa" },
        { key: "channel", label: "Channel", icon: "ph-user" },
        { key: "random", label: "Random Shuffle", icon: "ph-shuffle" },
      ];
      return {
        options,
        currentSort: homeSortBy(),
        currentDirection: homeSortDirection(),
        onSortChange: (k: string) => setHomeSortBy(k),
        onDirectionToggle: () =>
          setHomeSortDirection((d) => (d === "asc" ? "desc" : "asc")),
        onReshuffle: () => {
          setHomeRandomSeed(Date.now() + Math.random());
          if (homeSortBy() !== "random") setHomeSortBy("random");
        },
        hasShuffle: true,
      };
    }

    if (path.startsWith("/favourites")) {
      const options: SortOption[] = [
        { key: "date", label: "Date Added", icon: "ph-calendar-blank" },
        { key: "name", label: "Title (A-Z)", icon: "ph-text-aa" },
        { key: "channel", label: "Channel", icon: "ph-user" },
        { key: "random", label: "Random Shuffle", icon: "ph-shuffle" },
      ];
      return {
        options,
        currentSort: favSortBy(),
        currentDirection: favSortDirection(),
        onSortChange: (k: string) => setFavSortBy(k),
        onDirectionToggle: () =>
          setFavSortDirection((d) => (d === "asc" ? "desc" : "asc")),
        onReshuffle: () => {
          setFavRandomSeed(Date.now() + Math.random());
          if (favSortBy() !== "random") setFavSortBy("random");
        },
        hasShuffle: true,
      };
    }

    if (path.startsWith("/playlist")) {
      if (activePlaylistDetail()) {
        const options: SortOption[] = [
          { key: "custom", label: "Custom Order", icon: "ph-arrows-down-up" },
          { key: "date", label: "Date Added", icon: "ph-calendar-blank" },
          { key: "name", label: "Title (A-Z)", icon: "ph-text-aa" },
          { key: "channel", label: "Channel", icon: "ph-user" },
          { key: "random", label: "Random Shuffle", icon: "ph-shuffle" },
        ];
        return {
          options,
          currentSort: playlistVideosSortBy(),
          currentDirection: playlistVideosSortDirection(),
          onSortChange: (k: string) => setPlaylistVideosSortBy(k),
          onDirectionToggle: () =>
            setPlaylistVideosSortDirection((d) =>
              d === "asc" ? "desc" : "asc",
            ),
          onReshuffle: () => {
            setPlaylistVideosRandomSeed(Date.now() + Math.random());
            if (playlistVideosSortBy() !== "random")
              setPlaylistVideosSortBy("random");
          },
          hasShuffle: true,
        };
      }

      const options: SortOption[] = [
        { key: "date", label: "Date Created", icon: "ph-calendar-blank" },
        { key: "name", label: "Name (A-Z)", icon: "ph-text-aa" },
        { key: "count", label: "Video Count", icon: "ph-hash" },
      ];
      return {
        options,
        currentSort: playlistsSortBy(),
        currentDirection: playlistsSortDirection(),
        onSortChange: (k: string) => setPlaylistsSortBy(k),
        onDirectionToggle: () =>
          setPlaylistsSortDirection((d) => (d === "asc" ? "desc" : "asc")),
        hasShuffle: false,
      };
    }

    if (path === "/artists") {
      const options: SortOption[] = [
        { key: "name", label: "Name (A-Z)", icon: "ph-text-aa" },
        { key: "count", label: "Video Count", icon: "ph-hash" },
      ];
      return {
        options,
        currentSort: artistsSortBy(),
        currentDirection: artistsSortDirection(),
        onSortChange: (k: string) => setArtistsSortBy(k),
        onDirectionToggle: () =>
          setArtistsSortDirection((d) => (d === "asc" ? "desc" : "asc")),
        hasShuffle: false,
      };
    }

    if (path.startsWith("/artist/")) {
      const options: SortOption[] = [
        { key: "date", label: "Date Added", icon: "ph-calendar-blank" },
        { key: "name", label: "Title (A-Z)", icon: "ph-text-aa" },
        { key: "random", label: "Random Shuffle", icon: "ph-shuffle" },
      ];
      return {
        options,
        currentSort: artistVideosSortBy(),
        currentDirection: artistVideosSortDirection(),
        onSortChange: (k: string) => setArtistVideosSortBy(k),
        onDirectionToggle: () =>
          setArtistVideosSortDirection((d) => (d === "asc" ? "desc" : "asc")),
        onReshuffle: () => {
          setArtistVideosRandomSeed(Date.now() + Math.random());
          if (artistVideosSortBy() !== "random")
            setArtistVideosSortBy("random");
        },
        hasShuffle: true,
      };
    }

    if (path.startsWith("/downloads")) {
      const options: SortOption[] = [
        { key: "date", label: "Date", icon: "ph-calendar-blank" },
        { key: "title", label: "Title (A-Z)", icon: "ph-text-aa" },
        { key: "channel", label: "Channel", icon: "ph-user" },
        { key: "status", label: "Status", icon: "ph-check-circle" },
      ];
      return {
        options,
        currentSort: historySortBy(),
        currentDirection: historySortDirection(),
        onSortChange: (k: string) => setHistorySortBy(k),
        onDirectionToggle: () =>
          setHistorySortDirection((d) => (d === "asc" ? "desc" : "asc")),
        hasShuffle: false,
      };
    }

    return null;
  });

  const shouldRender = () => {
    return activeConfig() !== null && (alwaysShowSortBar() || isSortOpen());
  };

  const currentOption = () => {
    const cfg = activeConfig();
    if (!cfg) return null;
    return (
      cfg.options.find((opt) => opt.key === cfg.currentSort) || cfg.options[0]
    );
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setDropdownOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleOutsideClick);
    onCleanup(() =>
      document.removeEventListener("mousedown", handleOutsideClick),
    );
  });

  return (
    <Show when={shouldRender()}>
      <div
        class={`floating-sort-container ${isSortOpen() && !alwaysShowSortBar() ? "is-active-modal" : ""}`}
        ref={dropdownRef}
      >
        <div class="floating-sort-bar">
          {/* Sort Dropdown Trigger */}
          <button
            class="floating-sort-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen())}
            title="Change sorting criterion (Ctrl+S)"
          >
            <i
              class={`ph-bold ${currentOption()?.icon || "ph-arrows-down-up"} sort-icon-accent`}
            ></i>
            <span class="floating-sort-label">
              {currentOption()?.label || "Sort"}
            </span>
            <i
              class={`ph-bold ph-caret-down sort-caret ${dropdownOpen() ? "open" : ""}`}
            ></i>
          </button>

          {/* Direction Toggle Button (ASC / DESC) */}
          <button
            class="floating-sort-dir-btn"
            onClick={() => activeConfig()?.onDirectionToggle()}
            title={
              activeConfig()?.currentDirection === "asc"
                ? "Ascending (Click for Descending)"
                : "Descending (Click for Ascending)"
            }
          >
            <i
              class={`ph-bold ${activeConfig()?.currentDirection === "asc" ? "ph-sort-ascending" : "ph-sort-descending"}`}
            ></i>
          </button>

          {/* Shuffle button if random option exists and active */}
          <Show when={activeConfig()?.hasShuffle && activeConfig()?.onReshuffle}>
            <button
              class={`floating-sort-shuffle-btn ${activeConfig()?.currentSort === "random" ? "active" : ""}`}
              onClick={() => activeConfig()?.onReshuffle?.()}
              title="Shuffle Order"
            >
              <i class="ph-bold ph-shuffle"></i>
            </button>
          </Show>

          {/* Hotkey Tag */}
          <Show when={!alwaysShowSortBar() && isSortOpen()}>
            <div
              class="floating-sort-close"
              onClick={() => setIsSortOpen(false)}
              title="Close Sort Bar (Esc)"
            >
              <kbd>Esc</kbd>
            </div>
          </Show>
        </div>

        {/* Dropdown Menu */}
        <Show when={dropdownOpen()}>
          <div class="floating-sort-menu">
            <div class="floating-sort-menu-header">Sort By</div>
            <For each={activeConfig()?.options || []}>
              {(opt) => (
                <button
                  class={`floating-sort-menu-item ${activeConfig()?.currentSort === opt.key ? "active" : ""}`}
                  onClick={() => {
                    activeConfig()?.onSortChange(opt.key);
                    setDropdownOpen(false);
                  }}
                >
                  <div class="item-left">
                    <i class={`ph-bold ${opt.icon}`}></i>
                    <span>{opt.label}</span>
                  </div>
                  <Show when={activeConfig()?.currentSort === opt.key}>
                    <i class="ph-bold ph-check check-icon"></i>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
