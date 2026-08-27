import { createSignal, createMemo, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  VideoEntry,
  showConfirmDialog,
  addToast,
  favoritesSet,
  toggleFavoriteInCache,
} from "../store";
import "./VideoCard.css";

export interface VideoCardProps {
  video: VideoEntry;
  onClick?: () => void;
  showAvatar?: boolean;
  initialFavorite?: boolean;
  onToggleFavorite?: (id: string, isFav: boolean) => void;
  onDelete?: (video: VideoEntry) => void;
  onAddToPlaylist?: (video: VideoEntry) => void;
  onRemoveFromPlaylist?: (video: VideoEntry) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  style?: string;
}

export default function VideoCard(props: VideoCardProps) {
  const isFavorite = createMemo(() => {
    if (props.initialFavorite !== undefined) return props.initialFavorite;
    return favoritesSet().has(props.video.id);
  });
  const [isDeleting, setIsDeleting] = createSignal(false);

  const handleToggleFavorite = async (e: MouseEvent) => {
    e.stopPropagation();
    const newStatus = !isFavorite();
    try {
      await invoke("toggle_favorite", {
        id: props.video.id,
        isFavorite: newStatus,
      });
      toggleFavoriteInCache(props.video.id, newStatus);
      props.onToggleFavorite?.(props.video.id, newStatus);
      addToast(
        newStatus ? "Added to Favourites" : "Removed from Favourites",
        newStatus ? "success" : "info",
      );
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      addToast("Failed to update favourite status", "error");
    }
  };

  const handleAddToPlaylist = (e: MouseEvent) => {
    e.stopPropagation();
    props.onAddToPlaylist?.(props.video);
  };

  const handleRemoveFromPlaylist = (e: MouseEvent) => {
    e.stopPropagation();
    props.onRemoveFromPlaylist?.(props.video);
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isDeleting()) return;

    const confirmed = await showConfirmDialog(
      `Are you sure you want to permanently delete "${props.video.title}" from your library?`,
      "Delete Video",
      "warning",
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await invoke("delete_video", { videoId: props.video.id });
      addToast("Video deleted permanently", "info");
      props.onDelete?.(props.video);
    } catch (err) {
      console.error("Failed to delete video:", err);
      addToast(`Failed to delete video: ${err}`, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      class="video-card"
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onClick={props.onClick}
      style={props.style}
    >
      <div class="video-thumbnail-container">
        <img
          src={convertFileSrc(props.video.thumbnail_path)}
          alt={props.video.title}
          class="video-thumbnail"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div class="video-info">
        <h3 class="video-title" title={props.video.title}>
          {props.video.title}
        </h3>
        <div class="video-meta-row">
          <div class="video-channel-group">
            <Show when={props.showAvatar !== false}>
              <img
                src={
                  props.video.avatar_path
                    ? convertFileSrc(props.video.avatar_path)
                    : `http://127.0.0.1:1422/Avatars/${encodeURIComponent(props.video.channel)}.jpg`
                }
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                class="avatar-small"
                loading="lazy"
                decoding="async"
              />
            </Show>
            <p class="video-channel" title={props.video.channel}>
              {props.video.channel}
            </p>
          </div>

          <div class="video-card-actions">
            {/* Favorite Button */}
            <button
              class={`card-action-btn fav-btn ${isFavorite() ? "is-fav" : ""}`}
              onClick={handleToggleFavorite}
              title={
                isFavorite() ? "Remove from Favourites" : "Add to Favourites"
              }
            >
              <i
                class={`ph-fill ${isFavorite() ? "ph-heart" : "ph-heart"}`}
              ></i>
            </button>

            {/* Add to Playlist Button */}
            <Show when={props.onAddToPlaylist}>
              <button
                class="card-action-btn playlist-btn"
                onClick={handleAddToPlaylist}
                title="Add to Playlist"
              >
                <i class="ph-fill ph-list-plus"></i>
              </button>
            </Show>

            {/* Remove from Playlist Button */}
            <Show when={props.onRemoveFromPlaylist}>
              <button
                class="card-action-btn remove-pl-btn"
                onClick={handleRemoveFromPlaylist}
                title="Remove from this Playlist"
              >
                <i class="ph-fill ph-minus-circle"></i>
              </button>
            </Show>

            {/* Delete Button */}
            <Show when={props.onDelete}>
              <button
                class="card-action-btn delete-btn"
                onClick={handleDelete}
                title="Delete permanently"
              >
                <i class="ph-fill ph-trash"></i>
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
