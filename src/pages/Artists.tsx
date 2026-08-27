import { createSignal, onMount, createMemo, For, Show } from "solid-js";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import PremiumPlaceholder from "../components/PremiumPlaceholder";
import {
  VideoEntry,
  artistsSortBy,
  artistsSortDirection,
  homeVideos,
  setHomeVideos,
} from "../store";
import { sortArtists, ArtistEntry } from "../utils/sortUtils";
import "./Artists.css";

export default function Artists() {
  const [artists, setArtists] = createSignal<ArtistEntry[]>([]);
  const [countsMap, setCountsMap] = createSignal<Record<string, number>>({});
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const [artistData, allVideos] = await Promise.all([
        invoke<ArtistEntry[]>("get_artists"),
        homeVideos().length > 0
          ? Promise.resolve(homeVideos())
          : invoke<VideoEntry[]>("get_downloaded_videos").then((v) => {
              setHomeVideos(v);
              return v;
            }),
      ]);
      setArtists(artistData);

      // Fast single-pass in-memory count calculation
      const counts: Record<string, number> = {};
      const lowerCounts: Record<string, number> = {};
      for (const v of allVideos) {
        const ch = (v.channel || "").trim();
        const lower = ch.toLowerCase();
        lowerCounts[lower] = (lowerCounts[lower] || 0) + 1;
      }

      for (const a of artistData) {
        const lower = a.name.trim().toLowerCase();
        counts[a.name] = lowerCounts[lower] || 0;
      }

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
                  loading="lazy"
                  decoding="async"
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
