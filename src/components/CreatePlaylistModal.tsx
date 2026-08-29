import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { addToast } from "../store";
import "./PlaylistModals.css";

interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (playlist: Playlist) => void;
}

export default function CreatePlaylistModal(props: CreatePlaylistModalProps) {
  const [name, setName] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);

  createEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed || isLoading()) return;

    setIsLoading(true);
    try {
      const newPlaylist = await invoke<Playlist>("create_playlist", {
        name: trimmed,
      });
      addToast(`Playlist "${trimmed}" created!`, "success");
      setName("");
      props.onCreated?.(newPlaylist);
      props.onClose();
    } catch (err) {
      console.error("Failed to create playlist:", err);
      addToast(`Failed to create playlist: ${err}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="modal-backdrop"
        onClick={props.onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-playlist-modal-title"
      >
        <div class="modal-container" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title" id="create-playlist-modal-title">
              <i class="ph-fill ph-playlist" aria-hidden="true"></i>
              Create New Playlist
            </h3>
            <button
              class="modal-close-btn"
              onClick={props.onClose}
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <i class="ph ph-x" aria-hidden="true"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} class="modal-body">
            <p style="margin: 0; color: var(--secondary-text); font-size: 13px;">
              Enter a name for your new playlist. You can add videos to it
              anytime.
            </p>
            <input
              type="text"
              class="modal-input"
              placeholder="e.g., My Favorite Beats"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              autofocus
            />

            <div class="modal-actions">
              <button
                type="button"
                class="modal-btn cancel"
                onClick={props.onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="modal-btn primary"
                disabled={!name().trim() || isLoading()}
              >
                <Show
                  when={isLoading()}
                  fallback={
                    <>
                      <i class="ph-fill ph-plus-circle"></i> Create
                    </>
                  }
                >
                  <i class="ph ph-spinner spinIcon"></i> Creating...
                </Show>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
