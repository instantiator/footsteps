import { vi } from "vitest";

/** Stubs the media playback jsdom doesn't implement; call from beforeEach and restore with vi.restoreAllMocks. */
export const stubMediaPlayback = () => ({
  play: vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined),
  pause: vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined),
});
