import { createSignal, onMount, createMemo, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import VideoCard from "../components/VideoCard";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import VirtualGrid from "../components/VirtualGrid";
import {
  VideoEntry,
  favSortBy,
  favSortDirection,
  favRandomSeed,
  getThumbnailUrl,
} from "../store";
import { sortVideos } from "../utils/sortUtils";
import { preloadImages } from "../utils/imageLoader";
import "./Favourites.css";

export default function Favourites() {
  const [videos, setVideos] = createSignal<VideoEntry[]>([]);
  const [showAddToModal, setShowAddToModal] = createSignal(false);
  const [selectedVideoForAdd, setSelectedVideoForAdd] =
    createSignal<VideoEntry | null>(null);
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const data = await invoke<VideoEntry[]>("get_favorites");
      setVideos(data);
    } catch (e) {
      console.error("Failed to load favorites library:", e);
    }
  });

  const displayedVideos = createMemo(() => {
    return sortVideos(
      videos(),
      favSortBy(),
      favSortDirection(),
      favRandomSeed(),
    );
  });

  createEffect(() => {
    const list = displayedVideos();
    if (list.length > 0) {
      const urls = list.map((v) => getThumbnailUrl(v));
      preloadImages(urls);
    }
  });

  return (
    <div class="page-wrapper favourites-page">
      <AddToPlaylistModal
        isOpen={showAddToModal()}
        videoId={selectedVideoForAdd()?.id || null}
        videoTitle={selectedVideoForAdd()?.title}
        onClose={() => {
          setShowAddToModal(false);
          setSelectedVideoForAdd(null);
        }}
      />

      <h2 class="page-title">
        <i class="ph-fill ph-heart"></i> Favourites
      </h2>

      {videos().length === 0 ? (
        <PremiumPlaceholder
          title="No Favourites Found"
          subtitle="You haven't added any media to your favourites yet. Click the heart icon on any video to add it here."
          iconName="heart"
        />
      ) : (
        <VirtualGrid
          items={displayedVideos()}
          minItemWidth={340}
          gap={16}
          estimatedItemHeight={285}
          overscan={2}
          renderItem={(video) => (
            <VideoCard
              video={video}
              initialFavorite={true}
              onClick={() => navigate(`/player/${video.id}`)}
              onToggleFavorite={(id, isFav) => {
                if (!isFav) {
                  setVideos((prev) => prev.filter((v) => v.id !== id));
                }
              }}
              onAddToPlaylist={(v) => {
                setSelectedVideoForAdd(v);
                setShowAddToModal(true);
              }}
              onDelete={(v) => {
                setVideos((prev) => prev.filter((x) => x.id !== v.id));
              }}
            />
          )}
        />
      )}
    </div>
  );
}
