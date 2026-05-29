import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";

interface ArtistEntry {
  name: string;
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
    <div class="page-wrapper">
      <h2
        style={{
          "font-family": "var(--font-display)",
          "font-size": "28px",
          "margin-bottom": "30px",
          display: "flex",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <i
          class="ph-fill ph-microphone-stage"
          style={{ "font-size": "32px", color: "var(--primary-accent)" }}
        ></i>{" "}
        Artists
      </h2>

      {artists().length === 0 ? (
        <PremiumPlaceholder
          title="No Artists Found"
          subtitle="Download media to automatically populate your artists database."
          iconName="microphone-stage"
        />
      ) : (
        <div
          class="grid"
          style={{
            "grid-template-columns": "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          <For each={artists()}>
            {(artist) => (
              <div
                class="artist-card"
                onClick={() => navigate(`/artist/${artist.name}`)}
              >
                <img
                  src={`http://127.0.0.1:1422/Avatars/${artist.name}.jpg`}
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.className = "ph-fill ph-user avatar-large";
                  }}
                  class="avatar-large"
                />
                <h3
                  style={{
                    margin: "0",
                    "font-size": "16px",
                    "text-align": "center",
                    color: "var(--primary-text)",
                  }}
                >
                  {artist.name}
                </h3>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
