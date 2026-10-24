import { act, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CharacterCanvas from "../src/components/camera/CharacterCanvas";
import type { FeetPositions } from "../src/components/camera/CameraSupport";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import type { AppConfig } from "../src/config/AppConfig";
import AppConfigProvider from "../src/providers/AppConfigProvider";
import { noKeyPoints, type VisionFrame } from "../src/vision/VisionTypes";
import { FakeMediaStream } from "./helpers/media";

/** The mocked vision model: how many people it finds, and what it was asked to do. */
const model = vi.hoisted(() => {
  const load = vi.fn(async () => undefined);
  const detect = vi.fn();
  const dispose = vi.fn();
  const createVisionModel = vi.fn<(config: AppConfig) => object>(() => ({ load, detect, dispose }));
  return { people: 2, load, detect, dispose, createVisionModel };
});

vi.mock("../src/vision/createVisionModel", () => ({ createVisionModel: model.createVisionModel }));

vi.mock("../src/components/camera/DrawPeople", () => ({ drawPeople: vi.fn(async () => undefined) }));

/** Segmented frames waiting for the next animation frame, run by hand so each pass is controlled. */
const queuedFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

/** Runs the oldest queued animation frame. */
const runNextFrame = () => {
  const [id, callback] = Array.from(queuedFrames.entries())[0];
  queuedFrames.delete(id);
  callback(performance.now());
};

/** A frame of 8px masks: each person is a bottom row with their left foot in the middle of it. */
const fakeFrame = (people: number, timestamp: number): VisionFrame => ({
  width: 8,
  height: 8,
  timestamp,
  people: Array.from({ length: people }, (_, id) => ({
    id,
    mask: new Uint8Array(64).fill(1, 56),
    keyPoints: { ...noKeyPoints(), leftFoot: { x: 4, y: 7 } },
    scale: 1,
  })),
});

const video = document.createElement("video");
const mediaStream = new FakeMediaStream();

const renderCanvas = (props: Partial<ComponentProps<typeof CharacterCanvas>> = {}) =>
  render(<CharacterCanvas video={video} mediaStream={mediaStream} {...props} />);

beforeEach(() => {
  model.people = 2;
  model.detect.mockReset();
  model.detect.mockImplementation(async (_source: unknown, timestamp: number) => fakeFrame(model.people, timestamp));
  model.dispose.mockReset();
  model.load.mockClear();
  model.createVisionModel.mockClear();

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
  it("reports one player per person found, with their mask and feet", async () => {
    const onPlayersChange = vi.fn<(players: PlayerFrame[], timestamp: number) => void>();
    renderCanvas({ onPlayersChange });

    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());

    const [players, timestamp] = onPlayersChange.mock.calls[0];
    expect(players.map((player) => player.id)).toEqual([0, 1]);
    expect(players[0]).toMatchObject({ width: 8, height: 8 });
    expect(players[0].mask).toHaveLength(64);
    expect(players[0].feet?.percent.y).toBeCloseTo(87.5); // the lowest of eight rows
    expect(typeof timestamp).toBe("number");
    expect(model.detect).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("shows the frame-rate readout only when asked (%s)", async (showStats) => {
    const onPlayersChange = vi.fn();
    const { container } = renderCanvas({ onPlayersChange, showStats });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());
    await act(async () => runNextFrame()); // a second frame, so there is an interval to measure

    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(2));
    expect(container.querySelector("output.vision-stats") !== null).toBe(showStats);
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

  it("skips a frame that fails to be tracked, and carries on with the next", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    model.detect.mockRejectedValueOnce(new Error("WebGL context lost"));
    const onPlayersChange = vi.fn();
    renderCanvas({ onPlayersChange });

    await waitFor(() => expect(queuedFrames.size).toBe(1));
    expect(onPlayersChange).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);

    await act(async () => runNextFrame());
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(1));
  });

  it("stops tracking and disposes the model once on unmount", async () => {
    const onPlayersChange = vi.fn();
    const { unmount } = renderCanvas({ onPlayersChange });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());
    const trackedFrames = model.detect.mock.calls.length;
    expect(queuedFrames.size).toBe(1);

    unmount();

    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(queuedFrames.size).toBe(0); // the pending frame was cancelled
    expect(model.detect).toHaveBeenCalledTimes(trackedFrames);
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

    expect(model.createVisionModel).toHaveBeenCalledTimes(1); // the model is not reloaded
    expect(model.dispose).not.toHaveBeenCalled();
    expect(queuedFrames.size).toBe(1); // only the new loop is waiting

    await act(async () => {
      runNextFrame();
    });
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalledTimes(3));

    // One loop, so one frame's worth of tracking, not two
    expect(model.detect).toHaveBeenCalledTimes(3);
    expect(queuedFrames.size).toBe(1);
  });

  it("creates the model the app config chooses", async () => {
    const onPlayersChange = vi.fn();
    render(
      <MemoryRouter initialEntries={["/?visionModel=movenet"]}>
        <AppConfigProvider>
          <CharacterCanvas video={video} mediaStream={mediaStream} onPlayersChange={onPlayersChange} />
        </AppConfigProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());
    expect(model.createVisionModel).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "movenet" }));
  });

  it("does not use a model that is disposed before it finishes loading", async () => {
    let finishLoading = () => {};
    model.load.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (finishLoading = () => resolve(undefined))),
    );
    const { unmount } = renderCanvas({ onPlayersChange: vi.fn() });
    await waitFor(() => expect(model.load).toHaveBeenCalled());

    unmount();
    await act(async () => finishLoading());

    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(model.detect).not.toHaveBeenCalled();
  });

  it("keeps the loaded model when only the debug setting changes", async () => {
    const onPlayersChange = vi.fn();
    const withDebug = (debug: boolean) => (
      <MemoryRouter>
        <AppConfigProvider debug={debug}>
          <CharacterCanvas video={video} mediaStream={mediaStream} onPlayersChange={onPlayersChange} />
        </AppConfigProvider>
      </MemoryRouter>
    );
    const { rerender } = render(withDebug(false));
    await waitFor(() => expect(onPlayersChange).toHaveBeenCalled());

    rerender(withDebug(true));

    expect(model.createVisionModel).toHaveBeenCalledTimes(1);
    expect(model.dispose).not.toHaveBeenCalled();
  });
});
