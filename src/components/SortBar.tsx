import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { SortDirection, SortOption } from "../utils/sortUtils";
import { alwaysShowSortBar, isSortOpen, setIsSortOpen } from "../store";
import "./SortBar.css";

export interface SortBarProps {
  options: SortOption[];
  currentSort: string;
  currentDirection: SortDirection;
  onSortChange: (sortKey: string) => void;
  onDirectionToggle: () => void;
  onReshuffle?: () => void;
  itemCount?: number;
  itemLabel?: string;
}

export default function SortBar(props: SortBarProps) {
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const currentOption = () =>
    props.options.find((opt) => opt.key === props.currentSort) ||
    props.options[0];

  const isRandom = () => props.currentSort === "random";

  const isVisible = () => alwaysShowSortBar() || isSortOpen();

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
    <Show when={isVisible()}>
      <div class={`sort-bar-container ${isSortOpen() && !alwaysShowSortBar() ? "temporary-floating" : ""}`}>
        <div class="sort-bar-left">
          {/* Item Counter Badge */}
          <Show when={props.itemCount !== undefined}>
            <div class="sort-item-count">
              <span class="count-number">{props.itemCount}</span>
              <span class="count-label">
                {props.itemLabel ||
                  (props.itemCount === 1 ? "item" : "items")}
              </span>
            </div>
          </Show>
        </div>

        <div class="sort-bar-actions">
          {/* Sort Criteria Dropdown */}
          <div class="sort-dropdown-wrapper" ref={dropdownRef}>
            <button
              class="sort-dropdown-trigger clay-btn"
              onClick={() => setDropdownOpen(!dropdownOpen())}
              title="Change sorting criterion"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen()}
            >
              <i class={`ph-bold ${currentOption()?.icon || "ph-arrows-down-up"}`}></i>
              <span class="sort-label-text">
                <span class="sort-prefix">Sort:</span>{" "}
                {currentOption()?.label || "Sort"}
              </span>
              <i
                class={`ph-bold ph-caret-down dropdown-caret ${dropdownOpen() ? "open" : ""}`}
              ></i>
            </button>

            <Show when={dropdownOpen()}>
              <div class="sort-dropdown-menu">
                <div class="sort-dropdown-header">Sort By</div>
                <For each={props.options}>
                  {(opt) => (
                    <button
                      class={`sort-dropdown-item ${props.currentSort === opt.key ? "active" : ""}`}
                      onClick={() => {
                        props.onSortChange(opt.key);
                        setDropdownOpen(false);
                      }}
                    >
                      <div class="item-left">
                        <i class={`ph-bold ${opt.icon}`}></i>
                        <span>{opt.label}</span>
                      </div>
                      <Show when={props.currentSort === opt.key}>
                        <i class="ph-bold ph-check active-check"></i>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Direction Toggle Button (ASC / DESC) */}
          <button
            class="sort-direction-btn clay-btn"
            onClick={props.onDirectionToggle}
            title={
              props.currentDirection === "asc"
                ? "Ascending order (Click to switch to Descending)"
                : "Descending order (Click to switch to Ascending)"
            }
          >
            <i
              class={`ph-bold ${props.currentDirection === "asc" ? "ph-sort-ascending" : "ph-sort-descending"}`}
            ></i>
            <span class="direction-text">
              {props.currentDirection === "asc" ? "Asc" : "Desc"}
            </span>
          </button>

          {/* Re-shuffle / Roll Button (Visible when Random mode) */}
          <Show when={props.onReshuffle && isRandom()}>
            <button
              class="sort-reshuffle-btn clay-btn highlight"
              onClick={props.onReshuffle}
              title="Reshuffle random order"
            >
              <i class="ph-bold ph-shuffle"></i>
              <span class="reshuffle-text">Shuffle</span>
            </button>
          </Show>

          {/* Close button if temporarily shown via shortcut */}
          <Show when={!alwaysShowSortBar() && isSortOpen()}>
            <button
              class="sort-close-floating-btn clay-btn"
              onClick={() => setIsSortOpen(false)}
              title="Close Sort Bar (Esc)"
            >
              <i class="ph-bold ph-x"></i>
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
