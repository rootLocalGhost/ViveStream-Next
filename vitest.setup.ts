import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock localStorage to suppress Node 22+ ExperimentalWarnings
// and return `null` by default to mimic real browser behavior.
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
