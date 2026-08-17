import { createSignal, onMount, For } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useParams, useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import VideoCard from "../components/VideoCard";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import { VideoEntry, addToast } from "../store";
import "./ArtistPage.css";

export default function ArtistPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = createSignal<VideoEntry[]>([]);
  const [showAddToModal, setShowAddToModal] = createSignal(false);
  const [selectedVideoForAdd, setSelectedVideoForAdd] = createSignal<VideoEntry | null>(null);
  const [avatarTimestamp, setAvatarTimestamp] = createSignal<number>(Date.now());

  const artistName = () => {
    try {
      return decodeURIComponent(params.name || "");
    } catch {
      return params.name || "";
    }
  };

  const fetchVideos = async () => {
    const name = artistName();
    if (!name) return;
    try {
      const data = await invoke<VideoEntry[]>("get_videos_by_artist", {
        name: name,
      });
      setVideos(data);
    } catch (e) {
      console.error("Failed to load artist videos:", e);
    }
  };

  onMount(async () => {
    await fetchVideos();
  });

  const handleAvatarUpload = async () => {
    const name = artistName();
    if (!name) return;
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpeg", "jpg"],
        },
      ],
    });

    if (selected && typeof selected === "string") {
      try {
        await invoke("upload_artist_avatar", {
          name: name,
          imagePath: selected,
        });

        setAvatarTimestamp(Date.now());
        await fetchVideos();
        addToast("Artist avatar updated!", "success");
      } catch (e) {
        console.error("Failed to upload avatar", e);
        addToast("Failed to upload avatar", "error");
      }
    }
  };

  return (
    <div class="page-wrapper artist-page">
      <AddToPlaylistModal
        isOpen={showAddToModal()}
        videoId={selectedVideoForAdd()?.id || null}
        videoTitle={selectedVideoForAdd()?.title}
        onClose={() => {
          setShowAddToModal(false);
          setSelectedVideoForAdd(null);
        }}
      />

      <div class="clay-card flex-row-gap artist-hero-card">
        <img
          src={`http://127.0.0.1:1422/Avatars/${encodeURIComponent(
            artistName()
          )}.jpg?t=${avatarTimestamp()}`}
          onError={(e) => {
            if (videos().length > 0 && videos()[0].avatar_path) {
              e.currentTarget.src = convertFileSrc(videos()[0].avatar_path);
            } else {
              e.currentTarget.src = "";
              e.currentTarget.className = "ph-fill ph-user avatar-large";
            }
          }}
          class="avatar-large artist-avatar"
        />
        <div>
          <h2 class="page-title artist-header-title">{artistName()}</h2>
          <span class="settings-desc">
            {videos().length} Video{videos().length !== 1 && "s"}
          </span>
          <button
            class="primary-btn"
            style="margin-top: 10px;"
            onClick={handleAvatarUpload}
          >
            <i class="ph ph-upload" /> Upload Avatar
          </button>
        </div>
      </div>

      <div class="grid">
        <For each={videos()}>
          {(video) => (
            <VideoCard
              video={video}
              showAvatar={false}
              onClick={() =>
                navigate(
                  `/player/${video.id}?context=artist&name=${encodeURIComponent(
                    artistName()
                  )}`
                )
              }
              onAddToPlaylist={(v) => {
                setSelectedVideoForAdd(v);
                setShowAddToModal(true);
              }}
              onDelete={(v) => {
                setVideos((prev) => prev.filter((x) => x.id !== v.id));
              }}
            />
          )}
        </For>
      </div>
    </div>
  );
}
