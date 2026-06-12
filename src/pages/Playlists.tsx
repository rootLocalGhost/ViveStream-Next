import { createSignal, onMount, For, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import { VideoEntry } from "../store";
import "./Playlists.css";

interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

export default function Playlists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = createSignal<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = createSignal("");
  const [activePlaylist, setActivePlaylist] = createSignal<Playlist | null>(
    null,
  );
  const [playlistVideos, setPlaylistVideos] = createSignal<VideoEntry[]>([]);

  onMount(async () => {
    await fetchPlaylists();
  });

  const fetchPlaylists = async () => {
    try {
      const data = await invoke<Playlist[]>("get_playlists");
      setPlaylists(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!newPlaylistName().trim()) return;
    try {
      const newPlaylist = await invoke<Playlist>("create_playlist", {
        name: newPlaylistName(),
      });
      setPlaylists((prev) => [newPlaylist, ...prev]);
      setNewPlaylistName("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (e: Event, id: string) => {
    e.stopPropagation();
    try {
      await invoke("delete_playlist", { playlistId: id });
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (activePlaylist()?.id === id) setActivePlaylist(null);
    } catch (e) {
      console.error(e);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    try {
      const videos = await invoke<VideoEntry[]>("get_playlist_videos", {
        playlistId: playlist.id,
      });
      setPlaylistVideos(videos);
      setActivePlaylist(playlist);
    } catch (e) {
      console.error(e);
    }
  };

  const removeFromPlaylist = async (e: Event, videoId: string) => {
    e.stopPropagation();
    if (!activePlaylist()) return;
    try {
      await invoke("remove_video_from_playlist", {
        playlistId: activePlaylist()!.id,
        videoId: videoId,
      });
      setPlaylistVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div class="page-wrapper playlists-page">
      <Show when={!activePlaylist()}>
        <h2 class="page-title">
          <i class="ph-fill ph-list-dashes"></i> Playlists
        </h2>

        <div class="command-bar">
          <input
            type="text"
            placeholder="Name your new playlist..."
            value={newPlaylistName()}
            onInput={(e) => setNewPlaylistName(e.target.value)}
            class="command-input"
          />
          <button
            class="command-btn"
            onClick={handleCreate}
            disabled={!newPlaylistName().trim()}
          >
            <i class="ph-fill ph-plus-circle"></i>
            Create
          </button>
        </div>

        <div class="grid">
          <For each={playlists()}>
            {(playlist) => (
              <div
                class="clay-card flex-col-gap playlist-card"
                onClick={() => openPlaylist(playlist)}
              >
                <div class="flex-row-between">
                  <h3 class="settings-title">{playlist.name}</h3>
                  <button
                    class="control-btn playlist-remove-btn"
                    onClick={(e) => handleDelete(e, playlist.id)}
                  >
                    <i class="ph-fill ph-trash"></i>
                  </button>
                </div>
                <span class="settings-desc playlist-date">
                  {playlist.created_at}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={activePlaylist()}>
        <div class="flex-row-gap playlist-item-row">
          <button class="clay-btn" onClick={() => setActivePlaylist(null)}>
            <i class="ph ph-arrow-left"></i> Back
          </button>
          <h2 class="page-title playlist-active-title">
            {activePlaylist()?.name}
          </h2>
        </div>

        {playlistVideos().length === 0 ? (
          <p class="settings-desc">
            This playlist is empty. Add videos from the player menu.
          </p>
        ) : (
          <div class="grid">
            <For each={playlistVideos()}>
              {(video) => (
                <div
                  class="video-card"
                  onClick={() => navigate(`/player/${video.id}`)}
                >
                  <div class="relative-action">
                    <img
                      src={convertFileSrc(video.thumbnail_path)}
                      alt={video.title}
                      class="video-thumbnail"
                    />
                    <button
                      class="control-btn playlist-remove-btn"
                      onClick={(e) => removeFromPlaylist(e, video.id)}
                    >
                      <i class="ph-fill ph-minus"></i>
                    </button>
                  </div>
                  <div class="video-info">
                    <h3 class="video-title">{video.title}</h3>
                    <p class="video-channel">{video.channel}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}
