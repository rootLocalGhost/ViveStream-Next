/**
 * Ambient Lighting (Cinematic Glow) Engine for ViveStream-Next
 * Provides real-time dominant color extraction with saturation/vibrance weighting,
 * smooth color interpolation, and diagnostic logging.
 */

export interface AmbientColorResult {
  dominant: string;
  palette: string[];
  vibranceScore?: number;
  saturation?: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Converts RGB components (0-255) to a clean 6-character hex string.
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) =>
    Math.min(255, Math.max(0, Number.isFinite(v) ? Math.round(v) : 0));
  const hex = (v: number) => {
    const h = clamp(v).toString(16);
    return h.length === 1 ? "0" + h : h;
  };
  return `#${hex(r)}${hex(g)}${hex(b)}`;
};

/**
 * Parses a hex color (#RGB, #RRGGBB) into RGB object.
 */
export const hexToRgb = (hex: string): RGB => {
  if (!hex || typeof hex !== "string") {
    return { r: 242, g: 92, b: 84 };
  }
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0,
    };
  }
  return { r: 242, g: 92, b: 84 };
};

/**
 * Linear interpolation between two RGB colors.
 */
export const lerpColor = (current: RGB, target: RGB, factor: number): RGB => {
  const f = Math.min(1, Math.max(0, factor));
  return {
    r: current.r + (target.r - current.r) * f,
    g: current.g + (target.g - current.g) * f,
    b: current.b + (target.b - current.b) * f,
  };
};

/**
 * Calculates saturation (0..1) and lightness (0..1) from 0-255 RGB.
 */
export const getHslMetrics = (
  r: number,
  g: number,
  b: number,
): { saturation: number; lightness: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { saturation: 0, lightness };
  }

  const d = max - min;
  const saturation =
    lightness > 0.5 ? d / (2 - max - min) : d / (max + min);

  return { saturation, lightness };
};

/**
 * Extracts dominant and palette colors from an offscreen canvas sampling context.
 * Uses saturation and luminance weighting to prevent washed-out white/grey backgrounds
 * from drowning out the cinematic video lighting.
 */
export const extractDominantVideoColors = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fallbackColor = "#f25c54",
): AmbientColorResult => {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    if (!data || data.length === 0) {
      return {
        dominant: fallbackColor,
        palette: [fallbackColor],
      };
    }

    interface ColorBucket {
      r: number;
      g: number;
      b: number;
      count: number;
      saturation: number;
      lightness: number;
      score: number;
    }

    const buckets = new Map<string, ColorBucket>();
    let validPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue;

      const { saturation, lightness } = getHslMetrics(r, g, b);

      // Skip pure letterbox black borders
      if (r < 18 && g < 18 && b < 18) continue;

      // Filter out blinding washed-out whites/light greys unless there are no other colors
      const isBlindingWhite = lightness > 0.88 && saturation < 0.15;
      const isMuddyDark = lightness < 0.08 && saturation < 0.20;

      // Quantize into 16-step RGB buckets
      const qr = Math.min(255, Math.floor(r / 16) * 16 + 8);
      const qg = Math.min(255, Math.floor(g / 16) * 16 + 8);
      const qb = Math.min(255, Math.floor(b / 16) * 16 + 8);

      const key = `${qr},${qg},${qb}`;
      const existing = buckets.get(key);

      validPixels++;

      if (existing) {
        existing.count += 1;
      } else {
        const bucketMetrics = getHslMetrics(qr, qg, qb);
        buckets.set(key, {
          r: qr,
          g: qg,
          b: qb,
          count: 1,
          saturation: bucketMetrics.saturation,
          lightness: bucketMetrics.lightness,
          score: 0,
        });
      }

      // If extreme white/dark, slightly reduce candidate frequency impact
      if (isBlindingWhite || isMuddyDark) {
        const b = buckets.get(key);
        if (b) b.count = Math.max(1, b.count - 0.5);
      }
    }

    if (buckets.size === 0) {
      return {
        dominant: fallbackColor,
        palette: [fallbackColor],
      };
    }

    // Filter out isolated compression noise / tiny artifacts (< 1.5% of valid frame pixels)
    const minPixelThreshold = Math.max(2, Math.floor(validPixels * 0.015));
    const candidateBuckets = Array.from(buckets.values()).filter(
      (b) => b.count >= minPixelThreshold || buckets.size <= 3,
    );
    const activeBuckets = candidateBuckets.length > 0 ? candidateBuckets : Array.from(buckets.values());

    // Calculate score for each bucket:
    // Balance true prominent video color volume with moderate saturation boost
    for (const b of activeBuckets) {
      const satWeight = 1.0 + Math.pow(b.saturation, 1.1) * 1.8;
      const lightDiff = Math.abs(b.lightness - 0.5);
      const lightWeight = Math.max(0.35, 1.0 - lightDiff * 1.3);
      b.score = b.count * satWeight * lightWeight;
    }

    const sorted = activeBuckets.sort(
      (a, b) => b.score - a.score,
    );
    const top = sorted[0];
    const dominantHex = rgbToHex(top.r, top.g, top.b);

    const palette: string[] = [];
    for (const item of sorted) {
      const hex = rgbToHex(item.r, item.g, item.b);
      const isDistinct = palette.every((existingHex) => {
        const er = parseInt(existingHex.slice(1, 3), 16);
        const eg = parseInt(existingHex.slice(3, 5), 16);
        const eb = parseInt(existingHex.slice(5, 7), 16);
        const dist = Math.sqrt(
          (item.r - er) ** 2 + (item.g - eg) ** 2 + (item.b - eb) ** 2,
        );
        return dist > 32;
      });
      if (isDistinct) {
        palette.push(hex);
        if (palette.length >= 8) break;
      }
    }

    if (palette.length === 0) {
      palette.push(dominantHex);
    }

    return {
      dominant: dominantHex,
      palette,
      vibranceScore: top.score,
      saturation: top.saturation,
    };
  } catch (err) {
    logAmbient("Extraction Error", err);
    return {
      dominant: fallbackColor,
      palette: [fallbackColor],
    };
  }
};

/**
 * Diagnostic logger with throttling for real-time video playback events.
 */
let lastLogTimes: Record<string, number> = {};

export const logAmbient = (
  tag: string,
  message: any,
  throttleMs = 1500,
) => {
  const now = performance.now();
  const lastTime = lastLogTimes[tag] || 0;
  if (throttleMs === 0 || now - lastTime >= throttleMs) {
    lastLogTimes[tag] = now;
    if (typeof message === "object" && message !== null) {
      console.log(`[AmbientLighting:${tag}]`, JSON.stringify(message));
    } else {
      console.log(`[AmbientLighting:${tag}]`, message);
    }
  }
};
