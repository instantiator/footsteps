import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CharacterCamera from "../src/components/camera/CharacterCamera";
import { FakeMediaStream, FakeMediaStreamTrack, stubMediaPlayback } from "./helpers/media";
import { stubGetUserMedia } from "./helpers/permissions";

/** Renders the camera with spied callbacks, given its video back as the layout does. */
const renderCamera = () => {
  const props = {
    setStream: vi.fn(),
    setVideo: vi.fn(),
    onAspectChange: vi.fn(),
    onError: vi.fn(),
  };
  const view = render(<CharacterCamera stream={undefined} video={null} colorKey={false} {...props} />);
  const video = view.container.querySelector("video");
  view.rerender(<CharacterCamera stream={undefined} video={video} colorKey={false} {...props} />);
  return { ...view, ...props };
};

let camera: ReturnType<typeof stubGetUserMedia>;

beforeEach(() => {
  stubMediaPlayback();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  camera.restore();
  vi.restoreAllMocks();
});

describe("CharacterCamera", () => {
  it("shares the stream once the video is playing", async () => {
    camera = stubGetUserMedia();
    const { setStream, onAspectChange, onError } = renderCamera();

    await waitFor(() => expect(setStream).toHaveBeenCalledTimes(1));
    expect(onAspectChange).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports an error, rather than waiting forever, when the camera can't start", async () => {
    camera = stubGetUserMedia(new DOMException("Device in use", "NotReadableError"));
    const { setStream, onError } = renderCamera();

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(setStream).not.toHaveBeenCalled();
  });

  it("turns the camera off when unmounted before the stream arrives", async () => {
    camera = stubGetUserMedia();
    const track = new FakeMediaStreamTrack();
    let resolve: (stream: MediaStream) => void = () => undefined;
    camera.getUserMedia.mockReturnValue(new Promise((done) => (resolve = done)));
    const { unmount, setStream, onError } = renderCamera();

    unmount();
    resolve(new FakeMediaStream([track]));

    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(setStream).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("turns the camera off when the video can't play", async () => {
    camera = stubGetUserMedia();
    const track = new FakeMediaStreamTrack();
    camera.getUserMedia.mockResolvedValue(new FakeMediaStream([track]));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    const { onError } = renderCamera();

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(track.stop).toHaveBeenCalled();
  });
});
