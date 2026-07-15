import { createSignal, onMount, onCleanup, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  appTheme,
  toggleAppTheme,
  appPalette,
  toggleAppPalette,
  sidebarHoverMode,
  toggleSidebarHoverMode,
  concurrentDownloads,
  updateConcurrentDownloads,
  concurrentFragments,
  updateConcurrentFragments,
  speedLimit,
  updateSpeedLimit,
  browserCookies,
  updateBrowserCookies,
  playerClient,
  updatePlayerClient,
  autoSubtitles,
  toggleAutoSubtitles,
  removeSponsorBlock,
  toggleRemoveSponsorBlock,
  setForceSetup,
  showConfirmDialog,
  addToast,
} from "../store";
import "./Settings.css";

export default function Settings() {
  const [loadingDep, setLoadingDep] = createSignal(false);
  const [loadingClean, setLoadingClean] = createSignal(false);
  const [loadingNuclear, setLoadingNuclear] = createSignal(false);
  const [loadingUpdate, setLoadingUpdate] = createSignal(false);
  const [loadingReindex, setLoadingReindex] = createSignal(false);
  const [cookiesDropdownOpen, setCookiesDropdownOpen] = createSignal(false);
  const [clientDropdownOpen, setClientDropdownOpen] = createSignal(false);

  let cookiesRef: HTMLDivElement | undefined;
  let clientRef: HTMLDivElement | undefined;

  const cookieOptions = [
    "None",
    "Chrome",
    "Firefox",
    "Edge",
    "Brave",
    "Safari",
  ];

  const clientOptions = [
    "tv_embedded,web_embedded",
    "android_vr,tv,mweb",
    "mweb,tv,web_safari",
    "ios,android",
    "default",
  ];

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cookiesRef && !cookiesRef.contains(e.target as Node)) {
        setCookiesDropdownOpen(false);
      }
      if (clientRef && !clientRef.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
      document.removeEventListener("mousedown", handleClickOutside),
    );
  });

  const handleUpdateBinaries = async () => {
    setLoadingUpdate(true);
    try {
      await invoke("update_binaries");
      addToast(
        "Core engines (yt-dlp and FFmpeg) have been successfully updated to the latest versions.",
        "success",
      );
    } catch (e) {
      addToast(`Update failed: ${e}`, "error");
    } finally {
      setLoadingUpdate(false);
    }
  };

  const handleReindexLibrary = async () => {
    setLoadingReindex(true);
    try {
      const result = await invoke<string>("reindex_library", {
        playerClient: playerClient(),
      });
      addToast(result, "success");
    } catch (e) {
      addToast(`Re-indexing task failed: ${e}`, "error");
    } finally {
      setLoadingReindex(false);
    }
  };

  const handleWipeDependencies = async () => {
    const yes = await showConfirmDialog(
      "Are you sure you want to delete yt-dlp and FFmpeg? This will break downloads until you restart the app and run the setup again.\n\nYour downloaded videos will NOT be deleted.",
      "Wipe Core Dependencies",
      "warning",
    );
    if (yes) {
      setLoadingDep(true);
      try {
        await invoke("wipe_dependencies");
        addToast(
          "Dependencies wiped successfully. Restart ViveStream to trigger setup.",
          "info",
        );
      } catch (e) {
        addToast(`Failed to wipe dependencies: ${e}`, "error");
      } finally {
        setLoadingDep(false);
      }
    }
  };

  const handleCleanDatabase = async () => {
    const yes = await showConfirmDialog(
      "WARNING: This will permanently delete your SQLite database and all downloaded videos/media.\n\nYour core engines (yt-dlp/ffmpeg) will be kept. Are you sure?",
      "Clean Database & Media",
      "warning",
    );
    if (yes) {
      setLoadingClean(true);
      try {
        await invoke("clean_database_and_media");
        addToast("Database and media have been successfully cleaned.", "info");
      } catch (e) {
        addToast(`Clean failed: ${e}`, "error");
      } finally {
        setLoadingClean(false);
      }
    }
  };

  const handleNuclearWipe = async () => {
    const yes = await showConfirmDialog(
      "WARNING: This will permanently delete ALL core engines, your SQLite database, AND gigabytes of downloaded videos inside your ViveStream folder.\n\nThis cannot be undone. Are you absolutely sure?",
      "NUCLEAR WIPE",
      "error",
    );
    if (yes) {
      setLoadingNuclear(true);
      try {
        await invoke("nuclear_wipe");
        addToast(
          "Nuclear wipe complete. All app data and videos have been destroyed. You can now safely uninstall the application from your OS.",
          "info",
        );
      } catch (e) {
        addToast(`Nuclear wipe failed or was partially blocked: ${e}`, "error");
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

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Color Palette</h3>
            <p class="settings-desc">Choose a primary accent scheme.</p>
          </div>
          <div class="toggle-group">
            <button
              onClick={() => toggleAppPalette("sunset")}
              class={`toggle-btn ${appPalette() === "sunset" ? "active" : ""}`}
            >
              <div class="color-swatch sunset"></div> Sunset
            </button>
            <button
              onClick={() => toggleAppPalette("crimson")}
              class={`toggle-btn ${appPalette() === "crimson" ? "active" : ""}`}
            >
              <div class="color-swatch crimson"></div> Crimson
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

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
              max="5"
              step="1"
              value={concurrentDownloads()}
              onInput={(e) =>
                updateConcurrentDownloads(parseInt(e.target.value))
              }
              style={
                {
                  "--progress": `${((concurrentDownloads() - 1) / 4) * 100}%`,
                } as any
              }
            />
            <span class="slider-val">{concurrentDownloads()}</span>
          </div>
        </div>

        <div class="full-divider"></div>

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
              max="5"
              step="1"
              value={concurrentFragments()}
              onInput={(e) =>
                updateConcurrentFragments(parseInt(e.target.value))
              }
              style={
                {
                  "--progress": `${((concurrentFragments() - 1) / 4) * 100}%`,
                } as any
              }
            />
            <span class="slider-val">{concurrentFragments()}</span>
          </div>
        </div>

        <div class="full-divider"></div>

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

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">YouTube API Client Fallback</h3>
            <p class="settings-desc">
              Hot-swap client masquerading to bypass blocks (mweb requires PO
              tokens).
            </p>
          </div>
          <div
            class={`custom-select-wrapper ${clientDropdownOpen() ? "open" : ""}`}
            ref={clientRef}
          >
            <div
              class="custom-select-trigger"
              onClick={() => setClientDropdownOpen(!clientDropdownOpen())}
            >
              <span>{playerClient()}</span>
              <i class="ph ph-caret-down"></i>
            </div>
            <div class="custom-select-menu">
              <For each={clientOptions}>
                {(client) => (
                  <div
                    class={`custom-select-item ${playerClient() === client ? "selected" : ""}`}
                    onClick={() => {
                      updatePlayerClient(client);
                      setClientDropdownOpen(false);
                    }}
                  >
                    {client}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="full-divider"></div>

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

        <div class="full-divider"></div>

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Re-index Local Storage</h3>
            <p class="settings-desc">
              Scans your video directory to re-align metadata profiles and clean
              orphan database links.
            </p>
          </div>
          <button
            onClick={handleReindexLibrary}
            disabled={
              loadingReindex() ||
              loadingUpdate() ||
              loadingDep() ||
              loadingClean() ||
              loadingNuclear()
            }
            class="command-btn secondary"
          >
            <i
              class={`ph-fill ${loadingReindex() ? "ph-spinner spinIcon" : "ph-database"}`}
            ></i>
            {loadingReindex() ? "Re-indexing..." : "Re-index Library"}
          </button>
        </div>
      </div>

      <h2 class="page-title page-title-spaced page-title-danger">
        <i class="ph-fill ph-warning-circle"></i> Danger Zone
      </h2>

      <div class="danger-card">
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Force Setup Screen</h3>
            <p class="settings-desc">
              Launch the deployment screen to test setup rendering without
              deleting existing files.
            </p>
          </div>
          <button
            onClick={() => setForceSetup(true)}
            class="command-btn secondary"
          >
            Launch Setup
          </button>
        </div>

        <div class="full-divider danger-divider"></div>

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Update Core Engines</h3>
            <p class="settings-desc">
              Checks for, downloads, and overrides your current copies of
              `yt-dlp` and `ffmpeg` with their latest stable releases.
            </p>
          </div>
          <button
            onClick={handleUpdateBinaries}
            disabled={
              loadingUpdate() ||
              loadingDep() ||
              loadingClean() ||
              loadingNuclear() ||
              loadingReindex()
            }
            class="command-btn secondary"
          >
            <i
              class={`ph-fill ${loadingUpdate() ? "ph-spinner spinIcon" : "ph-arrow-clockwise"}`}
            ></i>
            {loadingUpdate() ? "Updating..." : "Update Engines"}
          </button>
        </div>

        <div class="full-divider danger-divider"></div>

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Wipe Core Engines</h3>
            <p class="settings-desc">
              Deletes `yt-dlp` and `ffmpeg` from your hidden app data.{" "}
              <strong>Does not delete videos.</strong>
            </p>
          </div>
          <button
            onClick={handleWipeDependencies}
            disabled={
              loadingDep() ||
              loadingUpdate() ||
              loadingClean() ||
              loadingNuclear() ||
              loadingReindex()
            }
            class="command-btn secondary"
          >
            {loadingDep() ? "Wiping..." : "Wipe Engines"}
          </button>
        </div>

        <div class="full-divider danger-divider"></div>

        <div class="flex-row-between">
          <div>
            <h3 class="settings-title danger">Clean Database & Media</h3>
            <p class="settings-desc">
              Deletes all downloaded videos, audio, and clears the SQLite
              database. <strong>Keeps core engines intact.</strong>
            </p>
          </div>
          <button
            onClick={handleCleanDatabase}
            disabled={
              loadingClean() ||
              loadingUpdate() ||
              loadingDep() ||
              loadingNuclear() ||
              loadingReindex()
            }
            class="command-btn danger"
          >
            <i
              class={`ph-fill ${loadingClean() ? "ph-spinner spinIcon" : "ph-trash"}`}
            ></i>
            {loadingClean() ? "Cleaning..." : "Clean Data"}
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
              <strong>ALL gigabytes of downloaded video/audio</strong>.
            </p>
          </div>
          <button
            onClick={handleNuclearWipe}
            disabled={
              loadingNuclear() ||
              loadingUpdate() ||
              loadingClean() ||
              loadingDep() ||
              loadingReindex()
            }
            class="command-btn danger"
          >
            <i
              class={`ph-fill ${loadingNuclear() ? "ph-spinner spinIcon" : "ph-warning-circle"}`}
            ></i>
            {loadingNuclear() ? "Destroying..." : "Delete Media & Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
