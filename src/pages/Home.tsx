import { createSignal, onMount, createMemo, createEffect, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import VideoCard from "../components/VideoCard";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import {
  homeVideos,
  setHomeVideos,
  VideoEntry,
  homeSortBy,
  homeSortDirection,
  homeRandomSeed,
  loadFavoritesCache,
  getThumbnailUrl,
} from "../store";
import { sortVideos } from "../utils/sortUtils";
import { preloadImages } from "../utils/imageLoader";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();
  const [showAddToModal, setShowAddToModal] = createSignal(false);
  const [selectedVideoForAdd, setSelectedVideoForAdd] =
    createSignal<VideoEntry | null>(null);

  onMount(async () => {
    try {
      const [data] = await Promise.all([
        invoke<VideoEntry[]>("get_downloaded_videos"),
        loadFavoritesCache(),
      ]);
      setHomeVideos(data);
    } catch (e) {
      console.error("Failed to load library:", e);
    }
  });

  const displayedVideos = createMemo(() => {
    return sortVideos(
      homeVideos(),
      homeSortBy(),
      homeSortDirection(),
      homeRandomSeed(),
    );
  });

  createEffect(() => {
    const list = displayedVideos();
    if (list.length > 0) {
      const urls = list.slice(0, 30).map((v) => getThumbnailUrl(v));
      preloadImages(urls);
    }
  });

  return (
    <div class="page-wrapper home-page">
      <AddToPlaylistModal
        isOpen={showAddToModal()}
        videoId={selectedVideoForAdd()?.id || null}
        videoTitle={selectedVideoForAdd()?.title}
        onClose={() => {
          setShowAddToModal(false);
          setSelectedVideoForAdd(null);
        }}
      />

      {homeVideos().length === 0 ? (
        <PremiumPlaceholder
          title="No Media Found"
          subtitle="Your local library is currently empty. Head over to the Downloads tab to start building your offline collection."
          iconName="film-strip"
        />
      ) : (
        <div class="grid">
          <For each={displayedVideos()}>
            {(video) => (
              <VideoCard
                video={video}
                onClick={() => navigate(`/player/${video.id}`)}
                onAddToPlaylist={(v) => {
                  setSelectedVideoForAdd(v);
                  setShowAddToModal(true);
                }}
                onDelete={(v) => {
                  setHomeVideos((prev) => prev.filter((x) => x.id !== v.id));
                }}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
}
