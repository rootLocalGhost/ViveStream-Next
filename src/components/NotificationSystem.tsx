import { For, Show } from "solid-js";
import { toasts, dialogState, closeDialog } from "../store";
import "./NotificationSystem.css";

export default function NotificationSystem() {
  return (
    <div class="notification-overlay">
      <div class="toast-container">
        <For each={toasts()}>
          {(toast) => (
            <div class={`toast-msg ${toast.type}`}>
              <i
                class={`ph-fill ${
                  toast.type === "error"
                    ? "ph-warning-circle"
                    : toast.type === "success"
                      ? "ph-check-circle"
                      : "ph-info"
                }`}
              ></i>
              <span>{toast.message}</span>
            </div>
          )}
        </For>
      </div>

      <Show when={dialogState()}>
        <div class="dialog-backdrop">
          <div class="dialog-box">
            <h3 class={`dialog-title ${dialogState()?.type}`}>
              <i
                class={`ph-fill ${
                  dialogState()?.type === "warning" ||
                  dialogState()?.type === "error"
                    ? "ph-warning"
                    : "ph-info"
                }`}
              ></i>
              {dialogState()?.title}
            </h3>
            <p class="dialog-message">{dialogState()?.message}</p>
            <div class="dialog-actions">
              <button
                class="dialog-btn cancel"
                onClick={() => closeDialog(false)}
              >
                Cancel
              </button>
              <button
                class="dialog-btn confirm"
                onClick={() => closeDialog(true)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
