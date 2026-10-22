import { act, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CharacterCanvas from "../src/components/camera/CharacterCanvas";
import type { FeetPositions } from "../src/components/camera/CameraSupport";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import { FakeMediaStream } from "./helpers/media";

/** The mocked segmentation model: how many people it finds, and what it was asked to do. */
const model = vi.hoisted(() => {
  const segmentPeople = vi.fn();
  const dispose = vi.fn();
  const createSegmenter = vi.fn(async () => ({ segmentPeople, dispose }));
  const decode = vi.fn();
  return { people: 2, segmentPeople, dispose, createSegmenter, decode };
});

vi.mock("@tensorflow-models/body-segmentation", () => ({
  SupportedModels: { BodyPix: "BodyPix" },
  createSegmenter: model.createSegmenter,
}));

vi.mock("@tensorflow/tfjs", () => ({ ready: vi.fn(async () => undefined) }));

vi.mock("../src/components/camera/BodySegSupport", () => ({ drawMask: vi.fn(async () => undefined) }));

/** Segmented frames waiting for the next animation frame, run by hand so each pass is controlled. */
const queuedFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

/** Runs the oldest queued animation frame. */
const runNextFrame = () => {
  const [id, callback] = Array.from(queuedFrames.entries())[0];
  queuedFrames.delete(id);
  callback(performance.now());
};

/** An 8px mask with an opaque bottom row, so it has feet, and a body part at its centre. */
const fakeMask = (): PlayerFrame["mask"] => {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let x = 0; x < width; x++) {
    const bottom = ((height - 1) * width + x) * 4;
    data[bottom] = 12; // torso
    data[bottom + 3] = 255;
  }
  return { data, width, height };
};

const video = document.createElement("video");
const mediaStream = new FakeMediaStream();

const renderCanvas = (props: Partial<ComponentProps<typeof CharacterCanvas>> = {}) =>
  render(<CharacterCanvas video={video} mediaStream={mediaStream} {...props} />);

beforeEach(() => {
  model.people = 2;
  model.segmentPeople.mockReset();
  model.segmentPeople.mockImplementation(async () =>
    Array.from({ length: model.people }, () => ({ mask: { toImageData: model.decode } })),
  );
  model.dispose.mockReset();
  model.createSegmenter.mockClear();
  model.decode.mockReset();
  model.decode.mockImplementation(async () => fakeMask());

  queuedFrames.clear();
  nextFrameId = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      queuedFrames.set(++nextFrameId, callback);
      return nextFrameId;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      queuedFrames.delete(id);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CharacterCanvas", () => {
  it("reports one player per segmented person, with a decoded mask and feet", async () => {
    const onPlayersChange = vi.fn<(players: PlayerFrame[], timestamp: number) => void>();
    renderCanvas({ onPlayersChange });

    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());

    const [players, timestamp] = onPlayersChange.mock.calls[0];
    expect(players.map((player) => player.id)).toEqual([0, 1]);
    expect(players[0].mask).toMatchObject({ width: 8, height: 8 });
    expect(players[0].feet?.percent.y).toBeCloseTo(87.5); // the lowest of eight rows
    expect(typeof timestamp).toBe("number");
    expect(model.decode).toHaveBeenCalledTimes(2);
  });

  it("reports an empty list when nobody is found", async () => {
    model.people = 0;
    const onPlayersChange = vi.fn<(players: PlayerFrame[], timestamp: number) => void>();
    renderCanvas({ onPlayersChange });

    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledWith([], expect.any(Number)));
  });

  it("reports feet positions separately, for the debug overlay", async () => {
    const onFeetPositionsChange = vi.fn<(feetPositions: FeetPositions) => void>();
    renderCanvas({ onFeetPositionsChange });

    await waitFor(() => expect(onFeetPositionsChange).toHaveBeenCalled());
    expect(Object.keys(onFeetPositionsChange.mock.calls[0][0])).toEqual(["0", "1"]);
  });

  it("stops segmenting and disposes the model once on unmount", async () => {
    const onPlayersChange = vi.fn();
    const { unmount } = renderCanvas({ onPlayersChange });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());
    const segmentedFrames = model.segmentPeople.mock.calls.length;
    const decodedMasks = model.decode.mock.calls.length;
    expect(queuedFrames.size).toBe(1);

    unmount();

    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(queuedFrames.size).toBe(0); // the pending frame was cancelled
    expect(model.segmentPeople).toHaveBeenCalledTimes(segmentedFrames);
    expect(model.decode).toHaveBeenCalledTimes(decodedMasks);
  });

  it("cancels the old loop and starts exactly one new one when the mask type changes", async () => {
    const onPlayersChange = vi.fn();
    const { rerender } = renderCanvas({ onPlayersChange, maskType: "binary" });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(1));
    expect(queuedFrames.size).toBe(1);

    rerender(
      <CharacterCanvas video={video} mediaStream={mediaStream} onPlayersChange={onPlayersChange} maskType="colored" />,
    );
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(2));

    expect(model.createSegmenter).toHaveBeenCalledTimes(1); // the model is not reloaded
    expect(model.dispose).not.toHaveBeenCalled();
    expect(queuedFrames.size).toBe(1); // only the new loop is waiting

    await act(async () => {
      runNextFrame();
    });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(3));

    // One loop, so one frame's worth of segmentation, not two
    expect(model.segmentPeople).toHaveBeenCalledTimes(3);
    expect(queuedFrames.size).toBe(1);
  });
});
