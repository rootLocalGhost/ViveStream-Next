import { createSignal, onMount, onCleanup, createMemo, createEffect, For, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useNavigate } from "@solidjs/router";
import { VideoEntry, showConfirmDialog, addToast, playlistsSortBy, playlistsSortDirection, playlistVideosSortBy, playlistVideosSortDirection, playlistVideosRandomSeed, setActivePlaylistDetail, getThumbnailUrl } from "../store";
import VideoCard from "../components/VideoCard";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import VirtualGrid from "../components/VirtualGrid";
import {
  sortPlaylists,
  sortPlaylistVideos,
} from "../utils/sortUtils";
import { preloadImages } from "../utils/imageLoader";
import "./Playlists.css";

interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

export default function Playlists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = createSignal<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = createSignal<Playlist | null>(
    null,
  );
  const [playlistVideos, setPlaylistVideos] = createSignal<VideoEntry[]>([]);
  const [countsMap, setCountsMap] = createSignal<Record<string, number>>({});
  const [firstThumbMap, setFirstThumbMap] = createSignal<
    Record<string, string>
  >({});

  const [editingTitle, setEditingTitle] = createSignal(false);
  const [tempTitle, setTempTitle] = createSignal("");
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);

  // Cache busting timestamps for uploaded assets
  const [coverTimestamps, setCoverTimestamps] = createSignal<
    Record<string, number>
  >({});
  const [bannerTimestamps, setBannerTimestamps] = createSignal<
    Record<string, number>
  >({});

  // Modals state
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showAddToModal, setShowAddToModal] = createSignal(false);
  const [selectedVideoForAdd, setSelectedVideoForAdd] =
    createSignal<VideoEntry | null>(null);

  onMount(async () => {
    await fetchPlaylists();
  });

  onCleanup(() => {
    setActivePlaylistDetail(null);
  });

  const fetchPlaylists = async () => {
    try {
      const data = await invoke<Playlist[]>("get_playlists");

      // Preload counts and first thumbnails for each playlist before updating state
      const counts: Record<string, number> = {};
      const thumbs: Record<string, string> = {};

      await Promise.all(
        data.map(async (pl) => {
          try {
            const vids = await invoke<VideoEntry[]>("get_playlist_videos", {
              playlistId: pl.id,
            });
            counts[pl.id] = vids.length;
            if (vids.length > 0 && vids[0].thumbnail_path) {
              thumbs[pl.id] = vids[0].lq_thumbnail_path || vids[0].thumbnail_path;
            }
          } catch {
            counts[pl.id] = 0;
          }
        }),
      );

      setCountsMap(counts);
      setFirstThumbMap(thumbs);
      setPlaylists(data);
    } catch (e) {
      console.error("Failed to load playlists:", e);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    try {
      const videos = await invoke<VideoEntry[]>("get_playlist_videos", {
        playlistId: playlist.id,
      });
      setPlaylistVideos(videos);
      setActivePlaylist(playlist);
      setActivePlaylistDetail(playlist);
      setEditingTitle(false);
    } catch (e) {
      console.error("Failed to open playlist:", e);
    }
  };

  const handleDeletePlaylist = async (playlistId: string, name?: string) => {
    const plName = name || activePlaylist()?.name || "this playlist";
    const confirmed = await showConfirmDialog(
      `Are you sure you want to delete "${plName}"? Videos in this playlist will remain in your library.`,
      "Delete Playlist",
      "warning",
    );

    if (!confirmed) return;

    try {
      await invoke("delete_playlist", { playlistId });
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      if (activePlaylist()?.id === playlistId) {
        setActivePlaylist(null);
      }
      addToast(`Playlist "${plName}" deleted`, "info");
    } catch (e) {
      console.error("Failed to delete playlist:", e);
      addToast(`Error deleting playlist: ${e}`, "error");
    }
  };

  const handleTitleSave = async () => {
    const pl = activePlaylist();
    const trimmed = tempTitle().trim();
    if (!pl || !trimmed) {
      setEditingTitle(false);
      return;
    }

    try {
      await invoke("update_playlist_title", {
        id: pl.id,
        newTitle: trimmed,
      });
      const updated = { ...pl, name: trimmed };
      setActivePlaylist(updated);
      setPlaylists(playlists().map((p) => (p.id === pl.id ? updated : p)));
      setEditingTitle(false);
      addToast("Playlist renamed", "success");
    } catch (e) {
      console.error("Failed to update playlist title:", e);
      addToast("Failed to rename playlist", "error");
    }
  };

  const handleCoverUpload = async (playlistId: string) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpeg", "jpg", "webp"] }],
    });
    if (selected && typeof selected === "string") {
      try {
        await invoke("upload_playlist_cover", {
          id: playlistId,
          imagePath: selected,
        });
        setCoverTimestamps((prev) => ({
          ...prev,
          [playlistId]: new Date().getTime(),
        }));
        addToast("Custom cover updated!", "success");
      } catch (err) {
        console.error("Failed to upload playlist cover:", err);
        addToast("Failed to update cover", "error");
      }
    }
  };

  const handleBannerUpload = async (playlistId: string) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpeg", "jpg", "webp"] }],
    });
    if (selected && typeof selected === "string") {
      try {
        await invoke("upload_playlist_banner", {
          id: playlistId,
          imagePath: selected,
        });
        setBannerTimestamps((prev) => ({
          ...prev,
          [playlistId]: new Date().getTime(),
        }));
        addToast("Custom banner updated!", "success");
      } catch (err) {
        console.error("Failed to upload playlist banner:", err);
        addToast("Failed to update banner", "error");
      }
    }
  };

  const removeFromPlaylist = async (videoId: string) => {
    const pl = activePlaylist();
    if (!pl) return;

    try {
      await invoke("remove_video_from_playlist", {
        playlistId: pl.id,
        videoId: videoId,
      });
      setPlaylistVideos((prev) => prev.filter((v) => v.id !== videoId));
      setCountsMap((prev) => ({
        ...prev,
        [pl.id]: Math.max(0, (prev[pl.id] || 1) - 1),
      }));
      addToast("Removed video from playlist", "info");
    } catch (e) {
      console.error("Failed to remove video from playlist:", e);
      addToast("Failed to remove video", "error");
    }
  };

  const handleDrop = async (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIdx = draggedIndex();
    const pl = activePlaylist();
    if (dragIdx === null || dragIdx === dropIndex || !pl) return;

    const items = [...playlistVideos()];
    const [draggedItem] = items.splice(dragIdx, 1);
    items.splice(dropIndex, 0, draggedItem);
    setPlaylistVideos(items);
    setDraggedIndex(null);

    try {
      await invoke("update_playlist_order", {
        playlistId: pl.id,
        videoIds: items.map((v) => v.id),
      });
    } catch (err) {
      console.error("Failed to reorder playlist", err);
    }
  };

  const playAll = () => {
    const vids = displayedPlaylistVideos();
    const pl = activePlaylist();
    if (vids.length > 0 && pl) {
      navigate(`/player/${vids[0].id}?context=playlist&id=${pl.id}`);
    }
  };

  // Helper to determine cover image for a playlist
  const getCoverSrc = (pl: Playlist) => {
    const ts = coverTimestamps()[pl.id];
    if (ts) {
      return `http://127.0.0.1:1422/PlaylistCovers/${pl.id}.jpg?t=${ts}`;
    }
    if (activePlaylist()?.id === pl.id && playlistVideos().length > 0) {
      return convertFileSrc(playlistVideos()[0].thumbnail_path);
    }
    const autoThumb = firstThumbMap()[pl.id];
    if (autoThumb) {
      return convertFileSrc(autoThumb);
    }
    return `http://127.0.0.1:1422/PlaylistCovers/${pl.id}.jpg`;
  };

  // Helper for banner image in detail view
  const getBannerSrc = (pl: Playlist) => {
    const ts = bannerTimestamps()[pl.id];
    if (ts) {
      return `http://127.0.0.1:1422/PlaylistBanners/${pl.id}.jpg?t=${ts}`;
    }
    if (playlistVideos().length > 0 && playlistVideos()[0].thumbnail_path) {
      return convertFileSrc(playlistVideos()[0].thumbnail_path);
    }
    return `http://127.0.0.1:1422/PlaylistBanners/${pl.id}.jpg`;
  };

  // Displayed Playlists with Sorting
  const displayedPlaylists = createMemo(() => {
    return sortPlaylists(
      playlists(),
      countsMap(),
      playlistsSortBy(),
      playlistsSortDirection(),
    );
  });

  // Displayed Videos inside Playlist with Sorting
  const displayedPlaylistVideos = createMemo(() => {
    return sortPlaylistVideos(
      playlistVideos(),
      playlistVideosSortBy(),
      playlistVideosSortDirection(),
      playlistVideosRandomSeed(),
    );
  });

  createEffect(() => {
    const list = displayedPlaylistVideos();
    if (list.length > 0) {
      const urls = list.map((v) => getThumbnailUrl(v));
      preloadImages(urls);
    }
  });

  return (
    <div class="page-wrapper playlists-page">
      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newPl) => {
          setPlaylists((prev) => [newPl, ...prev]);
          setCountsMap((prev) => ({ ...prev, [newPl.id]: 0 }));
          openPlaylist(newPl);
        }}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={showAddToModal()}
        videoId={selectedVideoForAdd()?.id || null}
        videoTitle={selectedVideoForAdd()?.title}
        onClose={() => {
          setShowAddToModal(false);
          setSelectedVideoForAdd(null);
          fetchPlaylists();
        }}
      />

      {/* Overview List */}
      <Show when={!activePlaylist()}>
        <div class="playlists-header-row">
          <h2 class="page-title" style="margin: 0;">
            <i class="ph-fill ph-list-dashes"></i> Playlists
          </h2>
          <button class="primary-btn" onClick={() => setShowCreateModal(true)}>
            <i class="ph-fill ph-plus-circle"></i> Create Playlist
          </button>
        </div>

        {playlists().length === 0 ? (
          <PremiumPlaceholder
            title="No Playlists Found"
            subtitle="Create your first playlist to organize your favorite videos and audio tracks."
            iconName="list-plus"
          />
        ) : (
          <div class="grid">
              <For each={displayedPlaylists()}>
                  {(playlist) => {
                    const count = () => countsMap()[playlist.id] || 0;
                    return (
                      <div
                        class="playlist-card"
                        onClick={() => openPlaylist(playlist)}
                      >
                        <div class="playlist-cover-wrapper">
                          <img
                            src={getCoverSrc(playlist)}
                            class="playlist-cover-img"
                            loading="lazy"
                            decoding="async"
                            onLoad={(e) => {
                              e.currentTarget.style.display = "block";
                              const fallback =
                                e.currentTarget.parentElement?.querySelector(
                                  ".playlist-cover-placeholder",
                                ) as HTMLElement | null;
                              if (fallback) fallback.style.display = "none";
                            }}
                            onError={(e) => {
                              const autoThumb = firstThumbMap()[playlist.id];
                              if (
                                autoThumb &&
                                !e.currentTarget.src.includes(
                                  encodeURIComponent(autoThumb),
                                )
                              ) {
                                e.currentTarget.src = convertFileSrc(autoThumb);
                              } else {
                                e.currentTarget.style.display = "none";
                                const fallback =
                                  e.currentTarget.parentElement?.querySelector(
                                    ".playlist-cover-placeholder",
                                  ) as HTMLElement | null;
                                if (fallback) fallback.style.display = "flex";
                              }
                            }}
                          />
                          <div
                            class="playlist-cover-placeholder"
                            style="display: none;"
                          >
                            <i class="ph-fill ph-playlist"></i>
                          </div>
                        </div>

                        <div class="playlist-card-footer">
                          <div class="playlist-card-meta">
                            <h3
                              class="playlist-card-title"
                              title={playlist.name}
                            >
                              {playlist.name}
                            </h3>
                            <span class="playlist-card-count">
                              <i class="ph ph-video"></i> {count()} video
                              {count() !== 1 ? "s" : ""}
                            </span>
                          </div>

                          <div class="playlist-card-actions">
                            <button
                              class="playlist-action-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPlaylist(playlist);
                                setTempTitle(playlist.name);
                                setEditingTitle(true);
                              }}
                              title="Rename"
                            >
                              <i class="ph-fill ph-pencil-simple"></i>
                            </button>
                            <button
                              class="playlist-action-icon delete-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePlaylist(
                                  playlist.id,
                                  playlist.name,
                                );
                              }}
                              title="Delete Playlist"
                            >
                              <i class="ph-fill ph-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
        </Show>

      {/* Playlist Detail / Full View */}
      <Show when={activePlaylist()}>
        {(() => {
          const pl = activePlaylist()!;
          return (
            <>
              {/* Hero Banner Header */}
              <div class="playlist-hero">
                <img
                  src={getBannerSrc(pl)}
                  class="playlist-hero-backdrop"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div class="playlist-hero-gradient"></div>

                <div class="playlist-hero-content">
                  <div class="playlist-hero-top-nav">
                    <button
                      class="playlist-hero-icon-btn"
                      onClick={() => {
                        setActivePlaylist(null);
                        setActivePlaylistDetail(null);
                        fetchPlaylists();
                      }}
                      title="Back to Playlists"
                    >
                      <i class="ph ph-arrow-left"></i>
                    </button>

                    <div class="playlist-hero-top-actions">
                      <button
                        class="playlist-hero-icon-btn"
                        onClick={() => handleBannerUpload(pl.id)}
                        title="Change Banner"
                      >
                        <i class="ph ph-image"></i>
                      </button>
                      <button
                        class="playlist-hero-icon-btn delete-btn"
                        onClick={() => handleDeletePlaylist(pl.id, pl.name)}
                        title="Delete Playlist"
                      >
                        <i class="ph ph-trash"></i>
                      </button>
                    </div>
                  </div>

                  <div class="playlist-hero-main">
                    <div class="playlist-hero-cover-container">
                      <img
                        src={getCoverSrc(pl)}
                        class="playlist-hero-cover"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <button
                        class="playlist-hero-cover-upload"
                        onClick={() => handleCoverUpload(pl.id)}
                        title="Change Cover Image"
                      >
                        <i class="ph-fill ph-camera"></i>
                      </button>
                    </div>

                    <div class="playlist-hero-info">
                      <span class="playlist-hero-tag">Playlist</span>

                      <Show
                        when={editingTitle()}
                        fallback={
                          <div class="playlist-rename-row">
                            <h1 class="playlist-hero-title">{pl.name}</h1>
                            <button
                              class="playlist-rename-btn"
                              onClick={() => {
                                setTempTitle(pl.name);
                                setEditingTitle(true);
                              }}
                              title="Rename Playlist"
                            >
                              <i class="ph-fill ph-pencil-simple"></i>
                            </button>
                          </div>
                        }
                      >
                        <div class="playlist-rename-edit-row">
                          <input
                            type="text"
                            class="playlist-hero-title-input"
                            value={tempTitle()}
                            onInput={(e) => setTempTitle(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleTitleSave();
                              else if (e.key === "Escape")
                                setEditingTitle(false);
                            }}
                            autofocus
                          />
                          <button
                            class="playlist-save-btn"
                            onClick={handleTitleSave}
                            title="Save"
                          >
                            <i class="ph-fill ph-check"></i>
                          </button>
                          <button
                            class="playlist-cancel-btn"
                            onClick={() => setEditingTitle(false)}
                            title="Cancel"
                          >
                            <i class="ph-fill ph-x"></i>
                          </button>
                        </div>
                      </Show>

                      <div class="playlist-hero-stats">
                        <span>
                          <i class="ph ph-film-strip"></i>{" "}
                          {playlistVideos().length} Video
                          {playlistVideos().length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div class="playlist-hero-actions">
                        <button
                          class="play-all-btn primary-btn"
                          onClick={playAll}
                          disabled={playlistVideos().length === 0}
                        >
                          <i class="ph-fill ph-play"></i> Play All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Videos Grid */}
              {playlistVideos().length === 0 ? (
                <PremiumPlaceholder
                  title="Playlist is Empty"
                  subtitle="Add videos to this playlist from Home, Favourites, or Artists pages using the Add to Playlist button on any video card."
                  iconName="film-strip"
                />
              ) : (
                <VirtualGrid
                  items={displayedPlaylistVideos()}
                  minItemWidth={340}
                  gap={16}
                  estimatedItemHeight={285}
                  overscan={2}
                  renderItem={(video, index) => (
                    <VideoCard
                      video={video}
                      draggable={playlistVideosSortBy() === "custom"}
                      onDragStart={(e) => {
                        if (playlistVideosSortBy() === "custom") {
                          e.dataTransfer?.setData(
                            "text/plain",
                            video.id,
                          );
                          setDraggedIndex(index());
                        }
                      }}
                      onDragOver={(e) => {
                        if (playlistVideosSortBy() === "custom") {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        if (playlistVideosSortBy() === "custom") {
                          handleDrop(e, index());
                        }
                      }}
                      style={
                        draggedIndex() === index()
                          ? "opacity: 0.4;"
                          : ""
                      }
                      onClick={() =>
                        navigate(
                          `/player/${video.id}?context=playlist&id=${pl.id}`,
                        )
                      }
                      onAddToPlaylist={(v) => {
                        setSelectedVideoForAdd(v);
                        setShowAddToModal(true);
                      }}
                      onRemoveFromPlaylist={(v) =>
                        removeFromPlaylist(v.id)
                      }
                      onDelete={(v) => {
                        setPlaylistVideos((prev) =>
                          prev.filter((x) => x.id !== v.id),
                        );
                      }}
                    />
                  )}
                />
                  )}
                </>
              );
            })()}
          </Show>
        </div>
  );
}
