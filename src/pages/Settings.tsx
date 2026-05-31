import { createSignal, onMount, onCleanup, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import {
  appTheme,
  toggleAppTheme,
  sidebarHoverMode,
  toggleSidebarHoverMode,
  appPalette,
  toggleAppPalette,
  concurrentDownloads,
  updateConcurrentDownloads,
  concurrentFragments,
  updateConcurrentFragments,
  speedLimit,
  updateSpeedLimit,
  browserCookies,
  updateBrowserCookies,
  autoSubtitles,
  toggleAutoSubtitles,
  removeSponsorBlock,
  toggleRemoveSponsorBlock,
} from "../store";

import "./Settings.css";

export default function Settings() {
  const [loadingDep, setLoadingDep] = createSignal(false);
  const [loadingNuclear, setLoadingNuclear] = createSignal(false);
  const [cookiesDropdownOpen, setCookiesDropdownOpen] = createSignal(false);

  let cookiesRef: HTMLDivElement | undefined;
  const cookieOptions = [
    "None",
    "Chrome",
    "Firefox",
    "Edge",
    "Brave",
    "Safari",
  ];

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cookiesRef && !cookiesRef.contains(e.target as Node)) {
        setCookiesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
      document.removeEventListener("mousedown", handleClickOutside),
    );
  });

  const handleWipeDependencies = async () => {
    const yes = await ask(
      "Are you sure you want to delete yt-dlp and FFmpeg? This will break downloads until you restart the app and run the setup again.\n\nYour downloaded videos will NOT be deleted.",
      { title: "Wipe Core Dependencies", kind: "warning" },
    );

    if (yes) {
      setLoadingDep(true);
      try {
        await invoke("wipe_dependencies");
        await message(
          "Dependencies wiped successfully. Restart ViveStream to trigger setup.",
          { title: "Success", kind: "info" },
        );
      } catch (e) {
        await message(`Failed to wipe dependencies: ${e}`, {
          title: "Error",
          kind: "error",
        });
      } finally {
        setLoadingDep(false);
      }
    }
  };

  const handleNuclearWipe = async () => {
    const yes = await ask(
      "WARNING: This will permanently delete ALL core engines, your SQLite database, AND gigabytes of downloaded videos inside your ViveStream folder.\n\nThis cannot be undone. Are you absolutely sure?",
      { title: "NUCLEAR WIPE", kind: "warning" },
    );

    if (yes) {
      setLoadingNuclear(true);
      try {
        await invoke("nuclear_wipe");
        await message(
          "Nuclear wipe complete. All app data and videos have been destroyed. You can now safely uninstall the application from your OS.",
          { title: "Wipe Complete", kind: "info" },
        );
      } catch (e) {
        await message(`Nuclear wipe failed or was partially blocked: ${e}`, {
          title: "Error",
          kind: "error",
        });
      } finally {
        setLoadingNuclear(false);
      }
    }
  };

  return (
    <div class="page-wrapper settings-page">
      <h2 class="page-title">
        <i class="ph-fill ph-gear"></i> Settings
      </h2>

      <div class="settings-card">
        {/* APPEARANCE TOGGLE */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Appearance</h3>
            <p class="settings-desc">
              Toggle between Light and Dark interface modes.
            </p>
          </div>
          <div class="toggle-group">
            <button
              onClick={() => toggleAppTheme("light")}
              class={`toggle-btn ${appTheme() === "light" ? "active" : ""}`}
            >
              <i
                class={appTheme() === "light" ? "ph-fill ph-sun" : "ph ph-sun"}
              ></i>{" "}
              Light
            </button>
            <button
              onClick={() => toggleAppTheme("dark")}
              class={`toggle-btn ${appTheme() === "dark" ? "active" : ""}`}
            >
              <i
                class={appTheme() === "dark" ? "ph-fill ph-moon" : "ph ph-moon"}
              ></i>{" "}
              Dark
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* PALETTE */}
        <div
          class="flex-row-between"
          classList={{ "palette-disabled": appTheme() === "dark" }}
        >
          <div>
            <h3 class="settings-title">Color Palette</h3>
            <p class="settings-desc">
              Choose a primary accent scheme. (Light mode only).
            </p>
          </div>
          <div class="toggle-group">
            <button
              onClick={() => toggleAppPalette("default")}
              class={`toggle-btn ${appPalette() === "default" ? "active" : ""}`}
            >
              <div class="color-swatch standard"></div> Standard
            </button>
            <button
              onClick={() => toggleAppPalette("sunset")}
              class={`toggle-btn ${appPalette() === "sunset" ? "active" : ""}`}
            >
              <div class="color-swatch sunset"></div> Sunset
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* AUTO-EXPAND SIDEBAR */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Auto-Expand Sidebar</h3>
            <p class="settings-desc">
              Automatically open the side navigation menu when hovering over it.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={sidebarHoverMode()}
              onChange={(e) => toggleSidebarHoverMode(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <h2 class="page-title page-title-spaced">
        <i class="ph-fill ph-sliders"></i> Engine Preferences
      </h2>

      <div class="settings-card">
        {/* CONCURRENT DOWNLOADS */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Concurrent Downloads</h3>
            <p class="settings-desc">
              Maximum number of videos to download at the same time.
            </p>
          </div>
          <div class="flex-row-gap">
            <input
              type="range"
              class="setting-slider"
              min="1"
              max="10"
              step="1"
              value={concurrentDownloads()}
              onInput={(e) =>
                updateConcurrentDownloads(parseInt(e.target.value))
              }
              style={
                {
                  "--progress": `${((concurrentDownloads() - 1) / 9) * 100}%`,
                } as any
              }
            />
            <span class="slider-val">{concurrentDownloads()}</span>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* CONCURRENT FRAGMENTS */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Concurrent Fragments</h3>
            <p class="settings-desc">
              Speeds up HLS/DASH downloads by fetching parts in parallel.
            </p>
          </div>
          <div class="flex-row-gap">
            <input
              type="range"
              class="setting-slider"
              min="1"
              max="10"
              step="1"
              value={concurrentFragments()}
              onInput={(e) =>
                updateConcurrentFragments(parseInt(e.target.value))
              }
              style={
                {
                  "--progress": `${((concurrentFragments() - 1) / 9) * 100}%`,
                } as any
              }
            />
            <span class="slider-val">{concurrentFragments()}</span>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* SPEED LIMIT */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Download Speed Limit</h3>
            <p class="settings-desc">
              e.g., 500K, 2.5M. Leave blank for no limit.
            </p>
          </div>
          <input
            type="text"
            class="setting-input"
            placeholder="No limit"
            value={speedLimit()}
            onInput={(e) => updateSpeedLimit(e.target.value)}
          />
        </div>

        <div class="full-divider"></div>

        {/* BROWSER COOKIES DROPDOWN */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Browser Cookies</h3>
            <p class="settings-desc">
              Use cookies from a browser to bypass login/age restrictions.
            </p>
          </div>
          <div
            class={`custom-select-wrapper ${cookiesDropdownOpen() ? "open" : ""}`}
            ref={cookiesRef}
          >
            <div
              class="custom-select-trigger"
              onClick={() => setCookiesDropdownOpen(!cookiesDropdownOpen())}
            >
              <span>{browserCookies()}</span>
              <i class="ph ph-caret-down"></i>
            </div>
            <div class="custom-select-menu">
              <For each={cookieOptions}>
                {(cookie) => (
                  <div
                    class={`custom-select-item ${browserCookies() === cookie ? "selected" : ""}`}
                    onClick={() => {
                      updateBrowserCookies(cookie);
                      setCookiesDropdownOpen(false);
                    }}
                  >
                    {cookie}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* AUTO SUBTITLES */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Download Automatic Subtitles</h3>
            <p class="settings-desc">
              If official subtitles aren't found, download auto-generated ones.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={autoSubtitles()}
              onChange={(e) => toggleAutoSubtitles(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="full-divider"></div>

        {/* REMOVE SPONSOR SEGMENTS */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Remove Sponsored Segments</h3>
            <p class="settings-desc">
              Automatically cut sponsored sections, intros, etc.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={removeSponsorBlock()}
              onChange={(e) => toggleRemoveSponsorBlock(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <h2 class="page-title page-title-spaced page-title-danger">
        <i class="ph-fill ph-warning-circle"></i> Danger Zone
      </h2>

      <div class="danger-card">
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Wipe Core Engines</h3>
            <p class="settings-desc">
              Deletes `yt-dlp` and `ffmpeg` from your hidden app data. Use this
              to force a clean re-download of the core engines.{" "}
              <strong>Does not delete videos.</strong>
            </p>
          </div>
          <button
            onClick={handleWipeDependencies}
            disabled={loadingDep() || loadingNuclear()}
            class="command-btn secondary"
          >
            {loadingDep() ? "Wiping..." : "Wipe Engines"}
          </button>
        </div>

        <div class="full-divider danger-divider"></div>

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title danger">
              Nuclear Wipe (Delete Everything)
            </h3>
            <p class="settings-desc">
              Permanently destroys the SQLite database, all core engines, and{" "}
              <strong>ALL gigabytes of downloaded video/audio</strong>. Run this
              before uninstalling the OS app.
            </p>
          </div>
          <button
            onClick={handleNuclearWipe}
            disabled={loadingNuclear() || loadingDep()}
            class="command-btn danger"
          >
            <i
              class={`ph-fill ${loadingNuclear() ? "ph-spinner spinIcon" : "ph-trash"}`}
            ></i>
            {loadingNuclear() ? "Destroying..." : "Delete Media & Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
