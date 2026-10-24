import { vi } from "vitest";

/** A video track stand-in, for jsdom which has none; `stop` is a spy, so tests can see the camera turned off. */
export class FakeMediaStreamTrack extends EventTarget implements MediaStreamTrack {
  contentHint = "";
  enabled = true;
  readonly id = "fake-track";
  readonly kind = "video";
  readonly label = "fake camera";
  readonly muted = false;
  onended = null;
  onmute = null;
  onunmute = null;
  readyState: MediaStreamTrackState = "live";
  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });
  applyConstraints = async (): Promise<void> => {};
  clone(): MediaStreamTrack {
    return this;
  }
  getCapabilities(): MediaTrackCapabilities {
    return {};
  }
  getConstraints(): MediaTrackConstraints {
    return {};
  }
  getSettings(): MediaTrackSettings {
    return {};
  }
}

/**
 * A MediaStream stand-in, for jsdom which has none: trackless unless given tracks.
 *
 * Tests mostly only need an object to pass between the camera, the layout and the canvas.
 */
export class FakeMediaStream extends EventTarget implements MediaStream {
  readonly id = "fake-stream";
  private readonly tracks: MediaStreamTrack[];

  constructor(tracks: MediaStreamTrack[] = []) {
    super();
    this.tracks = tracks;
  }

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
    return this.tracks;
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
