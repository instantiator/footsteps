import { useSyncExternalStore } from "react";

/**
 * The tracking loop's latest frame rate, for the HUD: null while no camera is being tracked.
 *
 * A store rather than React state, so the HUD can show it without the whole layout re-rendering on each update.
 */
let fps: number | null = null;
const listeners = new Set<() => void>();

/** Publishes the tracking loop's frame rate, rounded to whole frames; null when tracking stops. */
export const setTrackingFps = (next: number | null): void => {
  const rounded = next === null ? null : Math.round(next);
  if (rounded === fps) return;
  fps = rounded;
  listeners.forEach((listener) => listener());
};

/** Subscribes to frame-rate changes; returns the unsubscribe function. */
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The tracking loop's frame rate, or null while no camera is being tracked. */
export const useTrackingFps = (): number | null => useSyncExternalStore(subscribe, () => fps);
