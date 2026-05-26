import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";

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
      "WARNING: This will permanently delete ALL core dependencies, your JSON database, AND gigabytes of downloaded videos inside your ViveStream folder.\n\nThis cannot be undone. Are you absolutely sure?",
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
        style={{
          background: "rgba(18, 18, 18, 0.6)",
          padding: "30px",
          "border-radius": "16px",
          border: "1px solid var(--border-color)",
          "box-shadow": "0 10px 30px rgba(0,0,0,0.5)",
          "margin-bottom": "40px",
        }}
      >
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
              General Configuration
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
              Global preferences will be populated here in future updates.
            </p>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
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
              Permanently destroys the JSON database, all core engines, and{" "}
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
            {loadingNuclear() ? "Destroying..." : "Nuclear Wipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
