import { VideoEntry, DownloadHistoryEntry } from "../store";

export type SortDirection = "asc" | "desc";

export interface SortOption<T = string> {
  key: T;
  label: string;
  icon: string;
}

export interface PlaylistEntry {
  id: string;
  name: string;
  created_at: string;
}

export interface ArtistEntry {
  name: string;
  avatar_path: string;
}

/**
 * Seeded pseudo-random number generator (Mulberry32)
 * Ensures reproducible shuffling given a numeric seed, or random on seed update.
 */
export function seededRandom(seed: number) {
  let t = (seed += 0x6d2b79f5);
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with optional seed
 */
export function shuffleArray<T>(array: T[], seed: number = Date.now()): T[] {
  const result = [...array];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Natural string comparison with numeric collation (e.g. "Ep 2" < "Ep 10")
 */
export function naturalCompare(a: string, b: string): number {
  return (a || "").localeCompare(b || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Parses date string or returns fallback timestamp (e.g. from ID or epoch)
 */
export function parseDateTimestamp(dateStr?: string, fallbackId?: string): number {
  if (dateStr) {
    const parsed = Date.parse(dateStr.replace(" ", "T"));
    if (!isNaN(parsed)) return parsed;
  }
  if (fallbackId) {
    const num = parseInt(fallbackId, 10);
    if (!isNaN(num) && num > 1000000000) return num;
  }
  return 0;
}

/**
 * Sorts video entries by various criteria
 */
export function sortVideos(
  videos: VideoEntry[],
  sortBy: string = "date",
  direction: SortDirection = "desc",
  seed: number = 42,
): VideoEntry[] {
  if (!videos || videos.length <= 1) return [...(videos || [])];

  if (sortBy === "random") {
    const shuffled = shuffleArray(videos, seed);
    return direction === "desc" ? shuffled : shuffled.reverse();
  }

  const sorted = [...videos].sort((a, b) => {
    switch (sortBy) {
      case "name":
      case "title": {
        const cmp = naturalCompare(a.title, b.title);
        return cmp !== 0 ? cmp : naturalCompare(a.channel, b.channel);
      }
      case "channel":
      case "artist": {
        const cmp = naturalCompare(a.channel, b.channel);
        return cmp !== 0 ? cmp : naturalCompare(a.title, b.title);
      }
      case "date":
      default: {
        const timeA = parseDateTimestamp(a.added_at, a.id);
        const timeB = parseDateTimestamp(b.added_at, b.id);
        if (timeA !== timeB) return timeA - timeB;
        return naturalCompare(a.title, b.title);
      }
    }
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

/**
 * Sorts playlists
 */
export function sortPlaylists(
  playlists: PlaylistEntry[],
  countsMap: Record<string, number> = {},
  sortBy: string = "date",
  direction: SortDirection = "desc",
  seed: number = 42,
): PlaylistEntry[] {
  if (!playlists || playlists.length <= 1) return [...(playlists || [])];

  if (sortBy === "random") {
    const shuffled = shuffleArray(playlists, seed);
    return direction === "desc" ? shuffled : shuffled.reverse();
  }

  const sorted = [...playlists].sort((a, b) => {
    switch (sortBy) {
      case "name": {
        return naturalCompare(a.name, b.name);
      }
      case "count": {
        const countA = countsMap[a.id] || 0;
        const countB = countsMap[b.id] || 0;
        if (countA !== countB) return countA - countB;
        return naturalCompare(a.name, b.name);
      }
      case "date":
      default: {
        const timeA = parseDateTimestamp(a.created_at, a.id);
        const timeB = parseDateTimestamp(b.created_at, b.id);
        if (timeA !== timeB) return timeA - timeB;
        return naturalCompare(a.name, b.name);
      }
    }
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

/**
 * Sorts videos inside a playlist (includes "custom" order)
 */
export function sortPlaylistVideos(
  videos: VideoEntry[],
  sortBy: string = "custom",
  direction: SortDirection = "asc",
  seed: number = 42,
): VideoEntry[] {
  if (!videos || videos.length <= 1) return [...(videos || [])];

  if (sortBy === "custom") {
    // Custom preserves the original DB sequence or inverts if desc
    return direction === "desc" ? [...videos].reverse() : [...videos];
  }

  return sortVideos(videos, sortBy, direction, seed);
}

/**
 * Sorts artists
 */
export function sortArtists(
  artists: ArtistEntry[],
  videoCountsMap: Record<string, number> = {},
  sortBy: string = "name",
  direction: SortDirection = "asc",
  seed: number = 42,
): ArtistEntry[] {
  if (!artists || artists.length <= 1) return [...(artists || [])];

  if (sortBy === "random") {
    const shuffled = shuffleArray(artists, seed);
    return direction === "desc" ? shuffled : shuffled.reverse();
  }

  const sorted = [...artists].sort((a, b) => {
    switch (sortBy) {
      case "count": {
        const countA = videoCountsMap[a.name] || 0;
        const countB = videoCountsMap[b.name] || 0;
        if (countA !== countB) return countA - countB;
        return naturalCompare(a.name, b.name);
      }
      case "name":
      default: {
        return naturalCompare(a.name, b.name);
      }
    }
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

/**
 * Sorts download history items
 */
export function sortDownloadHistory(
  history: DownloadHistoryEntry[],
  sortBy: string = "date",
  direction: SortDirection = "desc",
): DownloadHistoryEntry[] {
  if (!history || history.length <= 1) return [...(history || [])];

  const sorted = [...history].sort((a, b) => {
    switch (sortBy) {
      case "title": {
        return naturalCompare(a.title, b.title);
      }
      case "channel": {
        return naturalCompare(a.channel, b.channel);
      }
      case "status": {
        return naturalCompare(a.status, b.status);
      }
      case "date":
      default: {
        const timeA = parseDateTimestamp(a.created_at);
        const timeB = parseDateTimestamp(b.created_at);
        return timeA - timeB;
      }
    }
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}
