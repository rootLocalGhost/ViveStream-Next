import { createSignal, onMount, createMemo, For, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import { VideoEntry, artistsSortBy, artistsSortDirection } from "../store";
import { sortArtists, ArtistEntry } from "../utils/sortUtils";
import "./Artists.css";

export default function Artists() {
  const [artists, setArtists] = createSignal<ArtistEntry[]>([]);
  const [countsMap, setCountsMap] = createSignal<Record<string, number>>({});
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const data = await invoke<ArtistEntry[]>("get_artists");
      setArtists(data);

      // Preload video counts for each artist
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (a) => {
          try {
            const vids = await invoke<VideoEntry[]>("get_videos_by_artist", {
              name: a.name,
            });
            counts[a.name] = vids.length;
          } catch {
            counts[a.name] = 0;
          }
        }),
      );
      setCountsMap(counts);
    } catch (e) {
      console.error("Failed to load artists library:", e);
    }
  });

  const displayedArtists = createMemo(() => {
    return sortArtists(
      artists(),
      countsMap(),
      artistsSortBy(),
      artistsSortDirection(),
    );
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
          <For each={displayedArtists()}>
            {(artist) => (
              <div
                class="artist-card"
                onClick={() =>
                  navigate(`/artist/${encodeURIComponent(artist.name)}`)
                }
              >
                <img
                  src={convertFileSrc(artist.avatar_path)}
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.className =
                      "ph-fill ph-user avatar-large";
                  }}
                  class="avatar-large"
                />
                <h3 class="settings-title artist-card-title">
                  {artist.name}
                </h3>
                <Show when={countsMap()[artist.name] !== undefined}>
                  <span class="artist-video-count">
                    <i class="ph ph-film-strip"></i>{" "}
                    {countsMap()[artist.name]} video
                    {countsMap()[artist.name] !== 1 ? "s" : ""}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
