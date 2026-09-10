import { describe, it, expect } from "vitest";
import {
  rgbToHex,
  hexToRgb,
  lerpColor,
  getHslMetrics,
  extractDominantVideoColors,
} from "../utils/ambientLighting";

describe("ambientLighting utility", () => {
  it("converts RGB to Hex correctly and clamps values", () => {
    expect(rgbToHex(255, 0, 128)).toBe("#ff0080");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(300, -10, 255)).toBe("#ff00ff");
    expect(rgbToHex(NaN, 100, 50)).toBe("#006432");
  });

  it("converts Hex to RGB correctly", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("invalid")).toEqual({ r: 242, g: 92, b: 84 });
  });

  it("lerps between colors smoothly", () => {
    const c1 = { r: 0, g: 0, b: 0 };
    const c2 = { r: 100, g: 200, b: 50 };
    const mid = lerpColor(c1, c2, 0.5);
    expect(mid).toEqual({ r: 50, g: 100, b: 25 });
  });

  it("calculates HSL saturation and lightness accurately", () => {
    const red = getHslMetrics(255, 0, 0);
    expect(red.saturation).toBeCloseTo(1.0);
    expect(red.lightness).toBeCloseTo(0.5);

    const white = getHslMetrics(255, 255, 255);
    expect(white.saturation).toBe(0);
    expect(white.lightness).toBe(1.0);

    const gray = getHslMetrics(128, 128, 128);
    expect(gray.saturation).toBe(0);
    expect(gray.lightness).toBeCloseTo(0.5, 1);
  });

  it("extracts dominant color with vibrance weighting preferring saturated colors over washed out whites", () => {
    // Mock canvas context with predominantly off-white pixels (70%) and some vibrant blue pixels (30%)
    const width = 10;
    const height = 10;
    const pixelCount = width * height;
    const data = new Uint8ClampedArray(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      if (i < 70) {
        // Off-white / light gray pixels
        data[idx] = 240;
        data[idx + 1] = 240;
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      } else {
        // Vibrant saturated blue pixels
        data[idx] = 20;
        data[idx + 1] = 100;
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      }
    }

    const mockCtx = {
      getImageData: () => ({ data, width, height }),
    } as unknown as CanvasRenderingContext2D;

    const result = extractDominantVideoColors(mockCtx, width, height);

    // The blue color should win despite having fewer pixels because of saturation/vibrance weighting
    const rgb = hexToRgb(result.dominant);
    expect(rgb.b).toBeGreaterThan(rgb.r);
    expect(rgb.b).toBeGreaterThan(150);
    expect(result.palette.length).toBeGreaterThan(0);
  });

  it("continuously updates and smooths colors across successive video frames", () => {
    // Frame 1: Vibrant Green
    const w = 4;
    const h = 4;
    const data1 = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h * 4; i += 4) {
      data1[i] = 20;
      data1[i + 1] = 220;
      data1[i + 2] = 40;
      data1[i + 3] = 255;
    }
    const ctx1 = { getImageData: () => ({ data: data1, width: w, height: h }) } as any;
    const res1 = extractDominantVideoColors(ctx1, w, h);
    let smoothed = hexToRgb(res1.dominant);
    expect(smoothed.g).toBeGreaterThan(180);

    // Frame 2: Scene transition to Vibrant Red
    const data2 = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h * 4; i += 4) {
      data2[i] = 240;
      data2[i + 1] = 30;
      data2[i + 2] = 20;
      data2[i + 3] = 255;
    }
    const ctx2 = { getImageData: () => ({ data: data2, width: w, height: h }) } as any;
    const res2 = extractDominantVideoColors(ctx2, w, h);
    const target2 = hexToRgb(res2.dominant);

    // Lerp across 3 animation ticks
    smoothed = lerpColor(smoothed, target2, 0.3);
    expect(smoothed.r).toBeGreaterThan(50);
    smoothed = lerpColor(smoothed, target2, 0.3);
    smoothed = lerpColor(smoothed, target2, 0.3);
    expect(smoothed.r).toBeGreaterThan(150);
    expect(smoothed.g).toBeLessThan(100);
  });
});
