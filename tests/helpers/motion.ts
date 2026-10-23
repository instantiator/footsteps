import { vi } from "vitest";

/** The media query the layout uses to skip its transitions. */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Replaces `matchMedia` so tests can choose reduced motion. The setup file turns it on before
 * every test; transition tests call this with `false` to opt into the fades.
 */
export const setReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn((query: string): MediaQueryList => ({
    matches: query === REDUCED_MOTION_QUERY ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
};
