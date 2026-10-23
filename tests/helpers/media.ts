import { vi } from "vitest";

/**
 * A trackless MediaStream stand-in, for jsdom which has none.
 *
 * Tests only need an object to pass between the camera, the layout and the canvas.
 */
export class FakeMediaStream extends EventTarget implements MediaStream {
  readonly id = "fake-stream";
  active = true;
  onaddtrack = null;
  onremovetrack = null;
  addTrack(): void {}
  clone(): MediaStream {
    return this;
  }
  getAudioTracks(): MediaStreamTrack[] {
    return [];
  }
  getTrackById(): MediaStreamTrack | null {
    return null;
  }
  getTracks(): MediaStreamTrack[] {
    return [];
  }
  getVideoTracks(): MediaStreamTrack[] {
    return [];
  }
  removeTrack(): void {}
}

/** Stubs the media playback jsdom doesn't implement; call from beforeEach and restore with vi.restoreAllMocks. */
export const stubMediaPlayback = () => ({
  play: vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined),
  pause: vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined),
});
