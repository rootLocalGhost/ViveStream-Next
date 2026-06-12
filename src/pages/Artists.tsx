import { createSignal, onMount, For } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import "./Artists.css";

interface ArtistEntry {
  name: string;
  avatar_path: string;
}

export default function Artists() {
  const [artists, setArtists] = createSignal<ArtistEntry[]>([]);
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const data = await invoke<ArtistEntry[]>("get_artists");
      setArtists(data);
    } catch (e) {
      console.error("Failed to load artists library:", e);
    }
  });

  return (
    <div class="page-wrapper artists-page">
      <h2 class="page-title">
        <i class="ph-fill ph-microphone-stage"></i> Artists
      </h2>

      {artists().length === 0 ? (
        <PremiumPlaceholder
          title="No Artists Found"
          subtitle="Download media to automatically populate your artists database."
          iconName="microphone-stage"
        />
      ) : (
        <div class="grid artists-grid">
          <For each={artists()}>
            {(artist) => (
              <div
                class="artist-card"
                onClick={() => navigate(`/artist/${artist.name}`)}
              >
                <img
                  src={convertFileSrc(artist.avatar_path)}
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.className = "ph-fill ph-user avatar-large";
                  }}
                  class="avatar-large"
                />
                <h3 class="settings-title artist-card-title">{artist.name}</h3>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
