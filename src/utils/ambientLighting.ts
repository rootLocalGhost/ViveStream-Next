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
 * Calculates HSV saturation (0..1), Chroma (0..1), Value (0..1), and HSL Lightness (0..1) from 0-255 RGB.
 */
export const getHslMetrics = (
  r: number,
  g: number,
  b: number,
): { saturation: number; lightness: number; value: number; chroma: number; hsvSaturation: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  const value = max;
  const hsvSaturation = max === 0 ? 0 : chroma / max;
  const hslSaturation =
    max === min ? 0 : lightness > 0.5 ? chroma / (2 - max - min) : chroma / (max + min);

  // Return hsvSaturation as saturation for accurate colorfulness estimation
  return {
    saturation: hsvSaturation,
    lightness,
    value,
    chroma,
    hsvSaturation,
  };
};

/**
 * Calculates Hue angle (0..360) from 0-255 RGB and pre-calculated Chroma.
 */
export const getHue = (r: number, g: number, b: number, chroma: number): number => {
  if (chroma < 0.0001) return 0;
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  let h = 0;
  if (max === rn) {
    h = ((gn - bn) / chroma) % 6;
  } else if (max === gn) {
    h = (bn - rn) / chroma + 2;
  } else {
    h = (rn - gn) / chroma + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
};

/**
 * Extracts dominant and palette colors from an offscreen canvas sampling context.
 * Clusters by Hue color-families with spatial edge weighting to capture genuine background lighting
 * while rejecting small center artifacts/visualizers.
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
      sumR: number;
      sumG: number;
      sumB: number;
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

      // Skip pure letterbox black borders
      if (r < 16 && g < 16 && b < 16) continue;

      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const chroma = max - min;
      const lightness = (max + min) / 2;

      // Spatial edge weighting: Edge pixels radiate outward as ambient bleed
      const pixelIdx = i / 4;
      const px = pixelIdx % w;
      const py = Math.floor(pixelIdx / w);
      const isEdge = px < w * 0.25 || px >= w * 0.75 || py < h * 0.25 || py >= h * 0.75;
      const weight = isEdge ? 1.5 : 1.0;

      let key: string;
      if (chroma < 0.08) {
        // Monochrome / grayscale cluster (6 lightness tiers)
        key = `mono-${Math.floor(lightness * 6)}`;
      } else {
        // Chromatic Hue sector (12 sectors of 30 deg) + Lightness band (5 bands)
        const hue = getHue(r, g, b, chroma);
        const hueSector = Math.floor(((hue + 15) % 360) / 30);
        const lightBand = Math.floor(lightness * 5);
        key = `color-${hueSector}-${lightBand}`;
      }

      const existing = buckets.get(key);
      validPixels += weight;

      if (existing) {
        existing.count += weight;
        existing.sumR += r * weight;
        existing.sumG += g * weight;
        existing.sumB += b * weight;
      } else {
        const bucketMetrics = getHslMetrics(r, g, b);
        buckets.set(key, {
          sumR: r * weight,
          sumG: g * weight,
          sumB: b * weight,
          count: weight,
          saturation: bucketMetrics.saturation,
          lightness: bucketMetrics.lightness,
          score: 0,
        });
      }
    }

    if (buckets.size === 0) {
      return {
        dominant: fallbackColor,
        palette: [fallbackColor],
      };
    }

    // Filter out tiny isolated noise (< 1.5% of frame weight)
    const minPixelThreshold = Math.max(3, Math.floor(validPixels * 0.015));
    const candidateBuckets = Array.from(buckets.values()).filter(
      (b) => b.count >= minPixelThreshold || buckets.size <= 3,
    );
    const activeBuckets =
      candidateBuckets.length > 0
        ? candidateBuckets
        : Array.from(buckets.values());

    // Calculate score for each bucket:
    // Volume count with HSV saturation and chroma weighting, strongly penalizing pale washed-out whites
    for (const b of activeBuckets) {
      const avgR = Math.round(b.sumR / b.count);
      const avgG = Math.round(b.sumG / b.count);
      const avgB = Math.round(b.sumB / b.count);
      const { saturation, lightness, value, chroma } = getHslMetrics(avgR, avgG, avgB);
      b.saturation = saturation;
      b.lightness = lightness;

      // Washed out white / light glare check (high value, low chroma)
      const isWashedOutWhite = value > 0.75 && saturation < 0.35;
      const glarePenalty = isWashedOutWhite ? 0.10 : 1.0;

      // Dark mud check
      const isMud = value < 0.08 && chroma < 0.05;
      const mudPenalty = isMud ? 0.15 : 1.0;

      const satWeight = 0.3 + Math.pow(saturation, 1.3) * 2.5 + chroma * 1.5;
      const lightDiff = Math.abs(lightness - 0.45);
      const lightWeight = Math.max(0.4, 1.0 - lightDiff * 0.9);

      b.score = Math.pow(b.count, 1.25) * satWeight * lightWeight * glarePenalty * mudPenalty;
    }

    const sorted = activeBuckets.sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const topR = Math.round(top.sumR / top.count);
    const topG = Math.round(top.sumG / top.count);
    const topB = Math.round(top.sumB / top.count);
    const dominantHex = rgbToHex(topR, topG, topB);

    const palette: string[] = [];
    if (dominantHex) {
      palette.push(dominantHex);
    }

    // Filter and rank candidate palette colors prioritizing rich chromatic aesthetics
    const paletteCandidates = activeBuckets
      .filter((b) => {
        const avgR = Math.round(b.sumR / b.count);
        const avgG = Math.round(b.sumG / b.count);
        const avgB = Math.round(b.sumB / b.count);
        const { saturation, value, chroma } = getHslMetrics(avgR, avgG, avgB);
        // Exclude near-black mud and washed-out white/glare
        if (value < 0.12 && chroma < 0.08) return false;
        if (value > 0.82 && saturation < 0.28) return false;
        return chroma >= 0.10 || saturation >= 0.25;
      })
      .sort((a, b) => {
        const avgRa = Math.round(a.sumR / a.count);
        const avgGa = Math.round(a.sumG / a.count);
        const avgBa = Math.round(a.sumB / a.count);
        const ma = getHslMetrics(avgRa, avgGa, avgBa);

        const avgRb = Math.round(b.sumR / b.count);
        const avgGb = Math.round(b.sumG / b.count);
        const avgBb = Math.round(b.sumB / b.count);
        const mb = getHslMetrics(avgRb, avgGb, avgBb);

        const scoreA = Math.pow(a.count, 0.85) * (0.5 + ma.saturation * 1.5 + ma.chroma);
        const scoreB = Math.pow(b.count, 0.85) * (0.5 + mb.saturation * 1.5 + mb.chroma);
        return scoreB - scoreA;
      });

    for (const item of paletteCandidates) {
      const avgR = Math.round(item.sumR / item.count);
      const avgG = Math.round(item.sumG / item.count);
      const avgB = Math.round(item.sumB / item.count);
      const hex = rgbToHex(avgR, avgG, avgB);
      const isDistinct = palette.every((existingHex) => {
        const er = parseInt(existingHex.slice(1, 3), 16);
        const eg = parseInt(existingHex.slice(3, 5), 16);
        const eb = parseInt(existingHex.slice(5, 7), 16);
        const dist = Math.sqrt(
          (avgR - er) ** 2 + (avgG - eg) ** 2 + (avgB - eb) ** 2,
        );
        return dist > 36;
      });
      if (isDistinct) {
        palette.push(hex);
        if (palette.length >= 6) break;
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
