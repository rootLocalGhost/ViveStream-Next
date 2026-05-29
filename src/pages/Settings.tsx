import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import {
  appTheme,
  toggleAppTheme,
  sidebarHoverMode,
  toggleSidebarHoverMode,
  appPalette,
  toggleAppPalette,
} from "../store";

export default function Settings() {
  const [loadingDep, setLoadingDep] = createSignal(false);
  const [loadingNuclear, setLoadingNuclear] = createSignal(false);

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
    <div class="page-wrapper">
      <h2 class="page-title">
        <i class="ph-fill ph-gear"></i> Settings
      </h2>

      <div class="settings-card">
        {/* Base Theme */}
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

        {/* Color Palette (Disabled in Dark Mode) */}
        <div
          class="flex-row-between"
          style={{
            opacity: appTheme() === "dark" ? 0.5 : 1,
            "pointer-events": appTheme() === "dark" ? "none" : "auto",
          }}
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
              <div class="color-swatch" style={{ background: "#ef233c" }}></div>{" "}
              Standard
            </button>
            <button
              onClick={() => toggleAppPalette("sunset")}
              class={`toggle-btn ${appPalette() === "sunset" ? "active" : ""}`}
            >
              <div class="color-swatch" style={{ background: "#f25c54" }}></div>{" "}
              Sunset
            </button>
          </div>
        </div>

        <div class="full-divider"></div>

        {/* Sidebar Expansion */}
        <div class="flex-row-between">
          <div>
            <h3 class="settings-title">Auto-Expand Sidebar</h3>
            <p class="settings-desc">
              Automatically open the side navigation menu when hovering over it.
            </p>
          </div>
          <button
            onClick={() => toggleSidebarHoverMode(!sidebarHoverMode())}
            class="clay-btn"
          >
            <i
              class={
                sidebarHoverMode() ? "ph-fill ph-check-square" : "ph ph-square"
              }
              style={{
                color: sidebarHoverMode() ? "var(--primary-accent)" : "inherit",
              }}
            ></i>
            {sidebarHoverMode() ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <h2 class="page-title page-title-danger">
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
            class="command-btn"
            style={{
              background: "transparent",
              border: "1px solid var(--border-color)",
              color: "var(--primary-text)",
            }}
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
            class="command-btn"
            style={{ background: "#e81123" }}
          >
            <i
              class={`ph-fill ${loadingNuclear() ? "ph-spinner spinIcon" : "ph-trash"}`}
              style={{ "font-size": "18px" }}
            ></i>
            {loadingNuclear() ? "Destroying..." : "Delete Media & Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
