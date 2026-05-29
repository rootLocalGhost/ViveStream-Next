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
      <h2
        style={{
          "font-family": "var(--font-display)",
          "font-size": "28px",
          "margin-bottom": "30px",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <i
          class="ph-fill ph-gear"
          style={{ "font-size": "32px", color: "var(--primary-accent)" }}
        ></i>{" "}
        Settings
      </h2>

      <div
        class="settings-section"
        style={{
          "border-radius": "16px",
          border: "1px solid var(--border-color)",
          "box-shadow": "var(--shadow-heavy)",
          "margin-bottom": "40px",
          display: "flex",
          "flex-direction": "column",
          gap: "24px",
        }}
      >
        {/* Base Theme */}
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "var(--primary-text)",
              }}
            >
              Appearance
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "500px",
              }}
            >
              Toggle between Light and Dark interface modes.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              background: "var(--tertiary-background)",
              padding: "6px",
              "border-radius": "12px",
              border: "1px solid var(--border-color)",
            }}
          >
            <button
              onClick={() => toggleAppTheme("light")}
              style={{
                background:
                  appTheme() === "light"
                    ? "var(--primary-background)"
                    : "transparent",
                color:
                  appTheme() === "light"
                    ? "var(--primary-text)"
                    : "var(--secondary-text)",
                border: "none",
                padding: "8px 16px",
                "border-radius": "8px",
                cursor: "pointer",
                "font-weight": "600",
                transition: "all 0.2s",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "box-shadow":
                  appTheme() === "light"
                    ? "0 2px 10px rgba(0,0,0,0.1)"
                    : "none",
              }}
            >
              <i
                class={appTheme() === "light" ? "ph-fill ph-sun" : "ph ph-sun"}
              ></i>{" "}
              Light
            </button>
            <button
              onClick={() => toggleAppTheme("dark")}
              style={{
                background:
                  appTheme() === "dark"
                    ? "var(--primary-background)"
                    : "transparent",
                color:
                  appTheme() === "dark"
                    ? "var(--primary-text)"
                    : "var(--secondary-text)",
                border: "none",
                padding: "8px 16px",
                "border-radius": "8px",
                cursor: "pointer",
                "font-weight": "600",
                transition: "all 0.2s",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "box-shadow":
                  appTheme() === "dark" ? "0 2px 10px rgba(0,0,0,0.2)" : "none",
              }}
            >
              <i
                class={appTheme() === "dark" ? "ph-fill ph-moon" : "ph ph-moon"}
              ></i>{" "}
              Dark
            </button>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "var(--border-color)",
            opacity: 0.2,
          }}
        ></div>

        {/* Color Palette (Disabled in Dark Mode) */}
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            opacity: appTheme() === "dark" ? 0.5 : 1,
            "pointer-events": appTheme() === "dark" ? "none" : "auto",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "var(--primary-text)",
              }}
            >
              Color Palette
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "500px",
              }}
            >
              Choose a primary accent scheme. (Light mode only).
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              background: "var(--tertiary-background)",
              padding: "6px",
              "border-radius": "12px",
              border: "1px solid var(--border-color)",
            }}
          >
            <button
              onClick={() => toggleAppPalette("default")}
              style={{
                background:
                  appPalette() === "default"
                    ? "var(--primary-background)"
                    : "transparent",
                color:
                  appPalette() === "default"
                    ? "var(--primary-text)"
                    : "var(--secondary-text)",
                border: "none",
                padding: "8px 16px",
                "border-radius": "8px",
                cursor: "pointer",
                "font-weight": "600",
                transition: "all 0.2s",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "box-shadow":
                  appPalette() === "default"
                    ? "0 2px 10px rgba(0,0,0,0.1)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#ef233c",
                  "border-radius": "50%",
                }}
              ></div>{" "}
              Standard
            </button>
            <button
              onClick={() => toggleAppPalette("sunset")}
              style={{
                background:
                  appPalette() === "sunset"
                    ? "var(--primary-background)"
                    : "transparent",
                color:
                  appPalette() === "sunset"
                    ? "var(--primary-text)"
                    : "var(--secondary-text)",
                border: "none",
                padding: "8px 16px",
                "border-radius": "8px",
                cursor: "pointer",
                "font-weight": "600",
                transition: "all 0.2s",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "box-shadow":
                  appPalette() === "sunset"
                    ? "0 2px 10px rgba(0,0,0,0.1)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#f25c54",
                  "border-radius": "50%",
                }}
              ></div>{" "}
              Sunset
            </button>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "var(--border-color)",
            opacity: 0.2,
          }}
        ></div>

        {/* Sidebar Expansion */}
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "var(--primary-text)",
              }}
            >
              Auto-Expand Sidebar
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "500px",
              }}
            >
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

      <h2
        style={{
          "font-family": "var(--font-display)",
          "font-size": "22px",
          "margin-bottom": "20px",
          color: "var(--primary-accent)",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <i
          class="ph-fill ph-warning-circle"
          style={{ "font-size": "24px" }}
        ></i>{" "}
        Danger Zone
      </h2>

      <div
        style={{
          background: "rgba(239, 35, 60, 0.05)",
          padding: "30px",
          "border-radius": "16px",
          border: "1px solid rgba(239, 35, 60, 0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            "margin-bottom": "30px",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "var(--primary-text)",
              }}
            >
              Wipe Core Engines
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "450px",
              }}
            >
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

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "rgba(239, 35, 60, 0.2)",
            "margin-bottom": "30px",
          }}
        ></div>

        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 5px 0",
                "font-family": "var(--font-body)",
                color: "#e81123",
              }}
            >
              Nuclear Wipe (Delete Everything)
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--secondary-text)",
                "font-size": "14px",
                "line-height": "1.5",
                "max-width": "450px",
              }}
            >
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
