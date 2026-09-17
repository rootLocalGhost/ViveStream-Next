# Utility Modules Reference

This document outlines the utility modules found in `src/utils/` that support core frontend functionalities.

## 1. Ambient Lighting (`ambientLighting.ts`)

This module handles the extraction of dominant colors from video frames and provides rhythmic fallback pulses for UI tinting during media playback.

### Core Functions

- **`extractDominantVideoColors(videoElement: HTMLVideoElement, x?: number, y?: number, width?: number, height?: number): AmbientColorResult`**
  Extracts the dominant color and generates an expanded complementary palette based on a specific region of a playing video element (typically sampled at low intervals).

- **`rgbToHex(r: number, g: number, b: number): string`**
  Converts RGB values to a standard hexadecimal string.

- **`hexToRgb(hex: string): RGB`**
  Converts a hexadecimal string back to an RGB object.

- **`lerpColor(current: RGB, target: RGB, factor: number): RGB`**
  Linearly interpolates between two colors, used for smooth, non-jarring transitions of ambient light.

### Exported Types
- `AmbientColorResult`
- `RGB`
- `AudioPulseMetrics`

---

## 2. Image Loader (`imageLoader.ts`)

This module optimizes frontend performance by concurrently pre-warming image URLs (like thumbnails and avatars) using priority queuing and background idle loading.

### Core Functions

- **`preloadImage(src: string): Promise<boolean>`**
  Forces the browser to fetch and decode an image asynchronously before it is mounted into the DOM.

- **`preloadImages(srcs: string[], immediateCount?: number, maxConcurrent?: number): void`**
  Takes an array of image URLs, immediately preloads a batch of them concurrently (for the initial viewport), and delegates the remainder to `requestIdleCallback` (or `setTimeout`) to prevent main-thread blocking.

- **`clearImageCache(): void`**
  Clears the in-memory cache of decoded or failed images.

- **`isImageDecoded(src: string): boolean` / `markImageDecoded(src: string): void`**
  Helpers to track image cache state.

- **`isImageFailed(src: string): boolean` / `markImageFailed(src: string): void`**
  Helpers to track images that failed to load, preventing repeated requests.

---

## 3. Sorting Utilities (`sortUtils.ts`)

This module provides seeded pseudo-random number generation, natural string comparisons, and dedicated sorting logic for complex media objects.

### Core Functions

- **`seededRandom(seed: number): () => number`**
  A Mulberry32 seeded pseudo-random number generator used for reproducible shuffling.

- **`shuffleArray<T>(array: T[], seed?: number): T[]`**
  Implements the Fisher-Yates shuffle algorithm, ensuring stable randomization given a numeric seed.

- **`naturalCompare(a: string, b: string): number`**
  Provides natural string comparison with numeric collation (e.g., ensuring "Ep 2" sorts before "Ep 10").

- **`parseDateTimestamp(dateStr?: string, fallbackId?: string): number`**
  Safely parses varying date formats or falls back to extraction from UNIX timestamp IDs.

### Media Sorters

- **`sortVideos(videos: VideoEntry[], sortBy?: string, direction?: SortDirection, seed?: number): VideoEntry[]`**
- **`sortPlaylists(playlists: PlaylistEntry[], countsMap?: Record<string, number>, sortBy?: string, direction?: SortDirection, seed?: number): PlaylistEntry[]`**
- **`sortPlaylistVideos(videos: VideoEntry[], sortBy?: string, direction?: SortDirection, seed?: number): VideoEntry[]`**
- **`sortArtists(artists: ArtistEntry[], videoCountsMap?: Record<string, number>, sortBy?: string, direction?: SortDirection, seed?: number): ArtistEntry[]`**
- **`sortDownloadHistory(history: DownloadHistoryEntry[], sortBy?: string, direction?: SortDirection): DownloadHistoryEntry[]`**

### Exported Types
- `SortDirection`
- `SortOption<T>`
- `PlaylistEntry`
- `ArtistEntry`
