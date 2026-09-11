import { describe, it, expect } from "vitest";
import {
  rgbToHex,
  hexToRgb,
  lerpColor,
  getHslMetrics,
  extractDominantVideoColors,
  AudioReactiveEngine,
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

  it("prioritizes rich cinematic colors (#781910) over pale washed-out glare (#f7f9ce)", () => {
    const w = 10;
    const h = 10;
    const pixelCount = w * h;
    const data = new Uint8ClampedArray(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      if (i < 50) {
        // 50% Pale off-white / light glare (#f7f9ce: 247, 249, 206)
        data[idx] = 247;
        data[idx + 1] = 249;
        data[idx + 2] = 206;
        data[idx + 3] = 255;
      } else {
        // 50% Deep saturated crimson (#781910: 120, 25, 16)
        data[idx] = 120;
        data[idx + 1] = 25;
        data[idx + 2] = 16;
        data[idx + 3] = 255;
      }
    }

    const mockCtx = {
      getImageData: () => ({ data, width: w, height: h }),
    } as unknown as CanvasRenderingContext2D;

    const result = extractDominantVideoColors(mockCtx, w, h);
    const rgb = hexToRgb(result.dominant);

    // Deep crimson should easily win due to high HSV saturation and anti-glare weighting
    expect(rgb.r).toBeGreaterThan(rgb.g);
    expect(rgb.r).toBeGreaterThan(rgb.b);
    expect(rgb.r).toBeGreaterThan(100);
    expect(rgb.g).toBeLessThan(50);
  });

  it("extracts dark crimson background (#71190e) in audio visualizer videos over center neon elements (#f78ff8)", () => {
    const w = 16;
    const h = 10;
    const pixelCount = w * h;
    const data = new Uint8ClampedArray(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const x = i % w;
      const y = Math.floor(i / w);

      // Center 3x3 has neon magenta visualizer element (#f78ff8: 247, 143, 248)
      if (x >= 7 && x <= 9 && y >= 4 && y <= 6) {
        data[idx] = 247;
        data[idx + 1] = 143;
        data[idx + 2] = 248;
        data[idx + 3] = 255;
      } else {
        // Gradient dark crimson background (#71190e: R ~ 90..125, G ~ 20..30, B ~ 10..18)
        data[idx] = 113;
        data[idx + 1] = 25;
        data[idx + 2] = 14;
        data[idx + 3] = 255;
      }
    }

    const mockCtx = {
      getImageData: () => ({ data, width: w, height: h }),
    } as unknown as CanvasRenderingContext2D;

    const result = extractDominantVideoColors(mockCtx, w, h);
    const rgb = hexToRgb(result.dominant);

    // Deep crimson background must dominate over small center visualizer
    expect(rgb.r).toBeGreaterThan(rgb.g);
    expect(rgb.r).toBeGreaterThan(rgb.b);
    expect(rgb.r).toBeGreaterThan(90);
    expect(rgb.g).toBeLessThan(40);
    expect(rgb.b).toBeLessThan(30);
  });

  it("AudioReactiveEngine handles uninitialized state and missing audio safely", () => {
    const engine = new AudioReactiveEngine();
    expect(engine.isConnected()).toBe(false);

    const metrics = engine.getPulseMetrics(100);
    expect(metrics.scale).toBe(1.0);
    expect(metrics.opacityMultiplier).toBe(1.0);
    expect(metrics.bassIntensity).toBe(0);
  });

  it("AudioReactiveEngine calculates bass-driven pulse metrics from frequency data", () => {
    const engine = new AudioReactiveEngine();

    // Mock internal analyser and frequency data buffer
    const mockData = new Uint8Array(128);
    // Fill bass bins with strong kick energy (values 200..255)
    for (let i = 0; i < 6; i++) {
      mockData[i] = 230;
    }

    (engine as any).analyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: (arr: Uint8Array) => {
        arr.set(mockData);
      },
    };
    (engine as any).dataArray = mockData;

    expect(engine.isConnected()).toBe(true);

    const metrics = engine.getPulseMetrics(100);
    expect(metrics.bassIntensity).toBeGreaterThan(0.2);
    expect(metrics.scale).toBeGreaterThan(1.0);
    expect(metrics.opacityMultiplier).toBeGreaterThan(1.0);

    // Higher sensitivity yields higher pulse scale and opacity
    const highSensMetrics = engine.getPulseMetrics(180);
    expect(highSensMetrics.scale).toBeGreaterThanOrEqual(metrics.scale);
  });
});

