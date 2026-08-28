import { createSignal, onMount, onCleanup, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  appTheme,
  toggleAppTheme,
  appPalette,
  toggleAppPalette,
  sidebarHoverMode,
  toggleSidebarHoverMode,
  alwaysShowSearchBar,
  toggleAlwaysShowSearchBar,
  showFpsCounter,
  toggleShowFpsCounter,
  thumbnailQuality,
  updateThumbnailQuality,
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
  setShowShortcutsModal,
  defaultSortBy,
  updateDefaultSortBy,
  defaultSortDirection,
  updateDefaultSortDirection,
  randomizeOnLaunch,
  toggleRandomizeOnLaunch,
  alwaysShowSortBar,
  toggleAlwaysShowSortBar,
} from "../store";
import BenchmarkModal from "../components/BenchmarkModal";
import "./Settings.css";

export default function Settings() {
  const [loadingDep, setLoadingDep] = createSignal(false);
  const [loadingClean, setLoadingClean] = createSignal(false);
  const [loadingNuclear, setLoadingNuclear] = createSignal(false);
  const [loadingUpdate, setLoadingUpdate] = createSignal(false);
  const [loadingReindex, setLoadingReindex] = createSignal(false);
  const [showBenchmark, setShowBenchmark] = createSignal(false);
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
      try {
        await invoke("update_binaries");
      } catch {
        await invoke("download_binaries");
      }
      addToast(
        "Core engines (yt-dlp, Deno, and FFmpeg) have been successfully updated to the latest versions.",
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
        <div class="flex-row-between" id="setting-appearance-theme">
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

        <div class="flex-row-between" id="setting-appearance-palette">
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

        <div class="flex-row-between" id="setting-appearance-sidebar">
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

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-appearance-searchbar">
          <div>
            <h3 class="settings-title">Always Show Search Bar</h3>
            <p class="settings-desc">
              Keep the global search bar visible in the top header instead of auto-hiding.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={alwaysShowSearchBar()}
              onChange={(e) => toggleAlwaysShowSearchBar(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-appearance-fps">
          <div>
            <h3 class="settings-title">Show FPS Counter</h3>
            <p class="settings-desc">
              Display an in-app real-time frame rate monitor in the corner.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={showFpsCounter()}
              onChange={(e) => toggleShowFpsCounter(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-appearance-thumb-quality">
          <div>
            <h3 class="settings-title">Thumbnail Quality (FPS & VRAM Optimization)</h3>
            <p class="settings-desc">
              Adjust thumbnail texture size. Lower settings deliver ultra-high frame rates (60–144 FPS) on dense fullscreen grids.
            </p>
          </div>
          <div class="quality-slider-wrapper">
            <div class="quality-step-labels">
              <span
                class={`step-label ${thumbnailQuality() === "low" ? "active" : ""}`}
                onClick={() => updateThumbnailQuality("low")}
              >
                360p (Ultra FPS)
              </span>
              <span
                class={`step-label ${thumbnailQuality() === "medium" ? "active" : ""}`}
                onClick={() => updateThumbnailQuality("medium")}
              >
                480p (Balanced)
              </span>
              <span
                class={`step-label ${thumbnailQuality() === "high" ? "active" : ""}`}
                onClick={() => updateThumbnailQuality("high")}
              >
                Original (High)
              </span>
            </div>
            <input
              type="range"
              class="setting-slider quality-range-slider"
              min="1"
              max="3"
              step="1"
              value={
                thumbnailQuality() === "low"
                  ? 1
                  : thumbnailQuality() === "high"
                    ? 3
                    : 2
              }
              onInput={(e) => {
                const val = parseInt(e.target.value);
                const q = val === 1 ? "low" : val === 3 ? "high" : "medium";
                updateThumbnailQuality(q);
              }}
              style={
                {
                  "--progress": `${
                    ((((thumbnailQuality() === "low"
                      ? 1
                      : thumbnailQuality() === "high"
                        ? 3
                        : 2) - 1) /
                      2) *
                    100)
                  }%`,
                } as any
              }
            />
          </div>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-appearance-shortcuts">
          <div>
            <h3 class="settings-title">Keyboard Shortcuts</h3>
            <p class="settings-desc">
              View all playback, media seeking, and app navigation keybindings.
            </p>
          </div>
          <button
            onClick={() => setShowShortcutsModal(true)}
            class="command-btn secondary"
            style="min-width: 140px;"
          >
            <i class="ph-fill ph-keyboard"></i> View Cheat Sheet
          </button>
        </div>
      </div>

      <h2 class="page-title page-title-spaced">
        <i class="ph-fill ph-sort-ascending"></i> Library Sorting & Presentation
      </h2>

      <div class="settings-card">
        <div class="flex-row-between" id="setting-sort-default-by">
          <div>
            <h3 class="settings-title">Default Sort Criterion</h3>
            <p class="settings-desc">
              Initial sorting order used when opening the video library.
            </p>
          </div>
          <div class="toggle-group">
            <button
              onClick={() => updateDefaultSortBy("date")}
              class={`toggle-btn ${defaultSortBy() === "date" ? "active" : ""}`}
            >
              <i class="ph ph-calendar-blank"></i> Date
            </button>
            <button
              onClick={() => updateDefaultSortBy("name")}
              class={`toggle-btn ${defaultSortBy() === "name" ? "active" : ""}`}
            >
              <i class="ph ph-text-aa"></i> Name
            </button>
            <button
              onClick={() => updateDefaultSortBy("channel")}
              class={`toggle-btn ${defaultSortBy() === "channel" ? "active" : ""}`}
            >
              <i class="ph ph-user"></i> Channel
            </button>
            <button
              onClick={() => updateDefaultSortBy("random")}
              class={`toggle-btn ${defaultSortBy() === "random" ? "active" : ""}`}
            >
              <i class="ph ph-shuffle"></i> Random
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-sort-default-direction">
          <div>
            <h3 class="settings-title">Default Sort Direction</h3>
            <p class="settings-desc">
              Preferred ordering sequence for chronological and alphabetical lists.
            </p>
          </div>
          <div class="toggle-group">
            <button
              onClick={() => updateDefaultSortDirection("desc")}
              class={`toggle-btn ${defaultSortDirection() === "desc" ? "active" : ""}`}
            >
              <i class="ph ph-sort-descending"></i> Descending
            </button>
            <button
              onClick={() => updateDefaultSortDirection("asc")}
              class={`toggle-btn ${defaultSortDirection() === "asc" ? "active" : ""}`}
            >
              <i class="ph ph-sort-ascending"></i> Ascending
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-sort-randomize-launch">
          <div>
            <h3 class="settings-title">Randomize Library on Startup</h3>
            <p class="settings-desc">
              Shuffle media order automatically on every launch to discover fresh content.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={randomizeOnLaunch()}
              onChange={(e) => toggleRandomizeOnLaunch(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="full-divider"></div>

        <div class="flex-row-between" id="setting-sort-always-show">
          <div>
            <h3 class="settings-title">Always Show Sort Bar</h3>
            <p class="settings-desc">
              Keep the floating sort controls visible at the top of library pages instead of auto-hiding. (Shortcut: <kbd style="background: var(--primary-background); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.8rem;">Ctrl+S</kbd>)
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={alwaysShowSortBar()}
              onChange={(e) => toggleAlwaysShowSortBar(e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <h2 class="page-title page-title-spaced">
        <i class="ph-fill ph-sliders"></i> Engine Preferences
      </h2>

      <div class="settings-card">
        <div class="flex-row-between" id="setting-engine-concurrent-dl">
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

        <div class="flex-row-between" id="setting-engine-concurrent-frag">
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

        <div class="flex-row-between" id="setting-engine-speed-limit">
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

        <div class="flex-row-between" id="setting-engine-browser-cookies">
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

        <div class="flex-row-between" id="setting-engine-youtube-client">
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

        <div class="flex-row-between" id="setting-engine-auto-subs">
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

        <div class="flex-row-between" id="setting-engine-sponsorblock">
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

        <div class="flex-row-between" id="setting-engine-reindex">
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

      <h2 class="page-title page-title-spaced">
        <i class="ph-fill ph-gauge"></i> Performance & Diagnostics
      </h2>

      <div class="settings-card">
        <div class="flex-row-between" id="setting-ui-benchmark">
          <div>
            <h3 class="settings-title">UI Rendering Benchmark</h3>
            <p class="settings-desc">
              Run hardware-accelerated diagnostics to test frame pacing, 1% low FPS,
              and 150-card DOM rendering throughput.
            </p>
          </div>
          <button
            onClick={() => setShowBenchmark(true)}
            class="command-btn secondary"
          >
            <i class="ph-fill ph-lightning"></i>
            Run Benchmark
          </button>
        </div>
      </div>

      <BenchmarkModal
        isOpen={showBenchmark()}
        onClose={() => setShowBenchmark(false)}
      />

      <h2 class="page-title page-title-spaced page-title-danger">
        <i class="ph-fill ph-warning-circle"></i> Danger Zone
      </h2>

      <div class="danger-card">
        <div class="flex-row-between" id="setting-danger-force-setup">
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

        <div class="flex-row-between" id="setting-danger-update-binaries">
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

        <div class="flex-row-between" id="setting-danger-wipe-dependencies">
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

        <div class="flex-row-between" id="setting-danger-clean-database">
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

        <div class="flex-row-between" id="setting-danger-nuclear-wipe">
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
