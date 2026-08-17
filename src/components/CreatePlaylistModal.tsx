import { createSignal, Show } from "solid-js";
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
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-container" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">
              <i class="ph-fill ph-playlist"></i>
              Create New Playlist
            </h3>
            <button
              class="modal-close-btn"
              onClick={props.onClose}
              title="Close"
            >
              <i class="ph ph-x"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} class="modal-body">
            <p style="margin: 0; color: var(--secondary-text); font-size: 13px;">
              Enter a name for your new playlist. You can add videos to it anytime.
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
