// High-Performance Image Caching, Pre-decoding & Error Memoization Engine

// In-memory set of image URLs that have been successfully decoded in the current session
const decodedImageCache = new Set<string>();

// Set of image URLs that failed to load (e.g. 404 avatars) to avoid repeated retry storms
const failedImageUrls = new Set<string>();

// Active preloading tasks
const activePreloads = new Set<string>();

/**
 * Checks if an image has already been decoded and cached in memory.
 */
export function isImageDecoded(src: string): boolean {
  if (!src) return false;
  return decodedImageCache.has(src);
}

/**
 * Marks an image as decoded in the cache.
 */
export function markImageDecoded(src: string): void {
  if (!src) return;
  decodedImageCache.add(src);
}

/**
 * Checks if an image URL previously failed to load.
 */
export function isImageFailed(src: string): boolean {
  if (!src) return false;
  return failedImageUrls.has(src);
}

/**
 * Records a failed image URL to prevent continuous 404 retries and DOM reflow storms.
 */
export function markImageFailed(src: string): void {
  if (!src) return;
  failedImageUrls.add(src);
}

/**
 * Pre-warms and decodes an image into browser GPU memory off the main thread.
 */
export function preloadImage(src: string): Promise<boolean> {
  if (!src || typeof window === "undefined" || isImageDecoded(src) || isImageFailed(src)) {
    return Promise.resolve(true);
  }

  if (activePreloads.has(src)) {
    return Promise.resolve(false);
  }

  activePreloads.add(src);

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";

    const cleanup = () => {
      activePreloads.delete(src);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = async () => {
      try {
        if ("decode" in img) {
          await img.decode();
        }
        markImageDecoded(src);
        cleanup();
        resolve(true);
      } catch {
        // Fallback: still treat onload as valid even if decode() throws on cancelled elements
        markImageDecoded(src);
        cleanup();
        resolve(true);
      }
    };

    img.onerror = () => {
      markImageFailed(src);
      cleanup();
      resolve(false);
    };

    img.src = src;
  });
}

/**
 * Concurrently pre-warms a list of image URLs with concurrency limit to prevent thread saturation.
 */
export function preloadImages(srcs: string[], maxConcurrent = 6): void {
  if (!srcs || srcs.length === 0 || typeof window === "undefined") return;

  const validSrcs = srcs.filter((s) => s && !isImageDecoded(s) && !isImageFailed(s));
  if (validSrcs.length === 0) return;

  let index = 0;
  let running = 0;

  const next = () => {
    while (running < maxConcurrent && index < validSrcs.length) {
      const src = validSrcs[index++];
      running++;
      preloadImage(src).finally(() => {
        running--;
        next();
      });
    }
  };

  next();
}

/**
 * Clears the in-memory image cache (useful for memory management or unit testing).
 */
export function clearImageCache(): void {
  decodedImageCache.clear();
  failedImageUrls.clear();
  activePreloads.clear();
}
