import { createSignal, createEffect, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { addToast } from "../store";
import "./PlaylistModals.css";

interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

interface AddToPlaylistModalProps {
  videoId: string | null;
  videoTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddToPlaylistModal(props: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = createSignal<Playlist[]>([]);
  const [playlistVideosMap, setPlaylistVideosMap] = createSignal<
    Record<string, number>
  >({});
  const [inPlaylistMap, setInPlaylistMap] = createSignal<
    Record<string, boolean>
  >({});
  const [newPlaylistName, setNewPlaylistName] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const loadPlaylistsAndStatus = async () => {
    if (!props.isOpen || !props.videoId) return;
    setIsLoading(true);
    try {
      const lists = await invoke<Playlist[]>("get_playlists");
      setPlaylists(lists);

      const inMap: Record<string, boolean> = {};
      const countMap: Record<string, number> = {};

      await Promise.all(
        lists.map(async (pl) => {
          try {
            const vids = await invoke<any[]>("get_playlist_videos", {
              playlistId: pl.id,
            });
            countMap[pl.id] = vids.length;
            inMap[pl.id] = vids.some((v) => v.id === props.videoId);
          } catch {
            countMap[pl.id] = 0;
            inMap[pl.id] = false;
          }
        }),
      );

      setInPlaylistMap(inMap);
      setPlaylistVideosMap(countMap);
    } catch (e) {
      console.error("Failed to fetch playlists:", e);
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen && props.videoId) {
      loadPlaylistsAndStatus();
    }
  });

  const togglePlaylist = async (playlist: Playlist) => {
    if (!props.videoId) return;
    const isCurrentlyIn = !!inPlaylistMap()[playlist.id];

    try {
      if (isCurrentlyIn) {
        await invoke("remove_video_from_playlist", {
          playlistId: playlist.id,
          videoId: props.videoId,
        });
        setInPlaylistMap((prev) => ({ ...prev, [playlist.id]: false }));
        setPlaylistVideosMap((prev) => ({
          ...prev,
          [playlist.id]: Math.max(0, (prev[playlist.id] || 1) - 1),
        }));
        addToast(`Removed from "${playlist.name}"`, "info");
      } else {
        await invoke("add_video_to_playlist", {
          playlistId: playlist.id,
          videoId: props.videoId,
        });
        setInPlaylistMap((prev) => ({ ...prev, [playlist.id]: true }));
        setPlaylistVideosMap((prev) => ({
          ...prev,
          [playlist.id]: (prev[playlist.id] || 0) + 1,
        }));
        addToast(`Added to "${playlist.name}"`, "success");
      }
    } catch (e) {
      console.error("Failed to toggle playlist membership:", e);
      addToast(`Error updating playlist: ${e}`, "error");
    }
  };

  const handleCreateAndAdd = async (e?: Event) => {
    if (e) e.preventDefault();
    const trimmed = newPlaylistName().trim();
    if (!trimmed || !props.videoId || isCreating()) return;

    setIsCreating(true);
    try {
      const newPlaylist = await invoke<Playlist>("create_playlist", {
        name: trimmed,
      });

      await invoke("add_video_to_playlist", {
        playlistId: newPlaylist.id,
        videoId: props.videoId,
      });

      setPlaylists((prev) => [newPlaylist, ...prev]);
      setInPlaylistMap((prev) => ({ ...prev, [newPlaylist.id]: true }));
      setPlaylistVideosMap((prev) => ({ ...prev, [newPlaylist.id]: 1 }));
      setNewPlaylistName("");
      addToast(`Created "${trimmed}" and added video!`, "success");
    } catch (err) {
      console.error("Failed to create & add to playlist:", err);
      addToast(`Failed: ${err}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-container" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">
              <i class="ph-fill ph-list-plus"></i>
              Add to Playlist
            </h3>
            <button
              class="modal-close-btn"
              onClick={props.onClose}
              title="Close"
            >
              <i class="ph ph-x"></i>
            </button>
          </div>

          <div class="modal-body">
            <Show when={props.videoTitle}>
              <div class="modal-video-preview">
                <i
                  class="ph-fill ph-film-strip"
                  style="color: var(--primary-accent); font-size: 20px;"
                ></i>
                <span class="modal-video-title">{props.videoTitle}</span>
              </div>
            </Show>

            {/* Quick create inline form */}
            <form onSubmit={handleCreateAndAdd} class="create-inline-row">
              <input
                type="text"
                class="modal-input"
                style="padding: 8px 12px; font-size: 13px;"
                placeholder="Create new playlist..."
                value={newPlaylistName()}
                onInput={(e) => setNewPlaylistName(e.currentTarget.value)}
              />
              <button
                type="submit"
                class="create-inline-btn"
                disabled={!newPlaylistName().trim() || isCreating()}
              >
                <Show
                  when={isCreating()}
                  fallback={
                    <>
                      <i class="ph-fill ph-plus"></i> Create
                    </>
                  }
                >
                  <i class="ph ph-spinner spinIcon"></i>
                </Show>
              </button>
            </form>

            <Show
              when={!isLoading()}
              fallback={
                <div style="display: flex; justify-content: center; padding: 20px;">
                  <i
                    class="ph ph-spinner spinIcon"
                    style="font-size: 24px; color: var(--primary-accent);"
                  ></i>
                </div>
              }
            >
              {playlists().length === 0 ? (
                <div style="text-align: center; padding: 16px; color: var(--secondary-text); font-size: 13px;">
                  No playlists yet. Type a name above to create your first one!
                </div>
              ) : (
                <div class="playlist-selection-list">
                  <For each={playlists()}>
                    {(pl) => {
                      const isIn = () => !!inPlaylistMap()[pl.id];
                      const count = () => playlistVideosMap()[pl.id] || 0;
                      return (
                        <div
                          class={`playlist-select-item ${isIn() ? "in-playlist" : ""}`}
                          onClick={() => togglePlaylist(pl)}
                        >
                          <div class="playlist-select-info">
                            <div class="playlist-select-icon">
                              <i class="ph-fill ph-playlist"></i>
                            </div>
                            <div class="playlist-select-details">
                              <span class="playlist-select-name">
                                {pl.name}
                              </span>
                              <span class="playlist-select-count">
                                {count()} video{count() !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <div class="playlist-select-status">
                            <i
                              class={`ph-fill ${isIn() ? "ph-check-circle" : "ph-plus"}`}
                            ></i>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              )}
            </Show>
          </div>

          <div class="modal-actions">
            <button class="modal-btn primary" onClick={props.onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
