// High-Performance Image Caching, Pre-decoding & Error Memoization Engine
const MAX_CACHE_SIZE = 600;

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
 * Marks an image as decoded in the cache with size bounding.
 */
export function markImageDecoded(src: string): void {
  if (!src) return;
  if (decodedImageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = decodedImageCache.values().next().value;
    if (firstKey) decodedImageCache.delete(firstKey);
  }
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
  if (failedImageUrls.size >= MAX_CACHE_SIZE) {
    const firstKey = failedImageUrls.values().next().value;
    if (firstKey) failedImageUrls.delete(firstKey);
  }
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
 * Concurrently pre-warms a list of image URLs with priority, then progressively loads the rest during browser idle periods.
 */
export function preloadImages(
  srcs: string[],
  immediateCount = 30,
  maxConcurrent = 6,
): void {
  if (!srcs || srcs.length === 0 || typeof window === "undefined") return;

  const validSrcs = srcs.filter(
    (s) => s && !isImageDecoded(s) && !isImageFailed(s),
  );
  if (validSrcs.length === 0) return;

  const immediateBatch = validSrcs.slice(0, immediateCount);
  const remainingBatch = validSrcs.slice(immediateCount);

  let running = 0;

  const processQueue = (items: string[], onDone?: () => void) => {
    let itemIndex = 0;
    const next = () => {
      while (running < maxConcurrent && itemIndex < items.length) {
        const src = items[itemIndex++];
        running++;
        preloadImage(src).finally(() => {
          running--;
          next();
        });
      }
      if (running === 0 && itemIndex >= items.length && onDone) {
        onDone();
      }
    };
    next();
  };

  // Immediate priority preloading for initial viewport
  processQueue(immediateBatch, () => {
    // Idle background preloading for remaining library items
    if (remainingBatch.length > 0) {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(
          () => {
            processQueue(remainingBatch);
          },
          { timeout: 2000 },
        );
      } else {
        setTimeout(() => {
          processQueue(remainingBatch);
        }, 100);
      }
    }
  });
}

/**
 * Clears the in-memory image cache (useful for memory management or unit testing).
 */
export function clearImageCache(): void {
  decodedImageCache.clear();
  failedImageUrls.clear();
  activePreloads.clear();
}
