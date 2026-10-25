import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import { keyPointsOfPose, MediaPipePoseModel } from "../src/vision/models/MediaPipePoseModel";

/** The mocked MediaPipe library. */
const mediapipe = vi.hoisted(() => {
  const detectForVideo = vi.fn();
  const close = vi.fn();
  const createFromOptions = vi.fn(async () => ({ detectForVideo, close }));
  return { detectForVideo, close, createFromOptions };
});

vi.mock("@mediapipe/tasks-vision", () => ({ PoseLandmarker: { createFromOptions: mediapipe.createFromOptions } }));
vi.mock("../src/vision/models/MediaPipeAssets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/vision/models/MediaPipeAssets")>()),
  mediapipeWasm: vi.fn(async () => ({ wasmLoaderPath: "", wasmBinaryPath: "vision.wasm" })),
}));

/** A pose with every landmark hidden, except the given ones at their normalised positions. */
const pose = (visible: Record<number, [x: number, y: number]>): NormalizedLandmark[] =>
  Array.from({ length: 33 }, (_, index) => {
    const [x, y] = visible[index] ?? [0, 0];
    return { x, y, z: 0, visibility: index in visible ? 0.9 : 0.1 };
  });

/** A mask that reports the given confidences. */
const confidenceMask = (values: number[], width: number) => ({
  width,
  height: values.length / width,
  getAsFloat32Array: () => Float32Array.from(values),
  close: vi.fn(),
});

beforeEach(() => {
  mediapipe.detectForVideo.mockReset();
  mediapipe.close.mockReset();
  mediapipe.createFromOptions.mockClear();
});

describe("keyPointsOfPose", () => {
  it("places each hand at the mean of its visible wrist and fingers, in pixels", () => {
    const { keyPoints } = keyPointsOfPose(pose({ 15: [0.1, 0.5], 19: [0.3, 0.5], 17: [0.9, 0.9] }), 100, 10);
    // The pinky (17) is listed, but visible; all three count
    expect(keyPoints.leftHand?.x).toBeCloseTo((10 + 30 + 90) / 3);
    expect(keyPoints.rightHand).toBeNull();
  });

  it("ignores landmarks the model can't see", () => {
    const hidden = pose({ 27: [0.5, 0.9] });
    hidden[29] = { x: 0, y: 0, z: 0, visibility: 0.2 };
    expect(keyPointsOfPose(hidden, 100, 100).keyPoints.leftFoot).toEqual({ x: 50, y: 90 });
  });

  it("places the head from the ears and eyes, and scales hands and feet to its width", () => {
    const { keyPoints, scale } = keyPointsOfPose(
      pose({ 2: [0.45, 0.2], 5: [0.55, 0.2], 7: [0.4, 0.22], 8: [0.6, 0.22] }),
      100,
      100,
    );
    expect(keyPoints.headLeft).toEqual({ x: 40, y: 22 });
    expect(keyPoints.headRight).toEqual({ x: 60, y: 22 });
    expect(keyPoints.headTop?.y).toBeLessThan(20);
    expect(keyPoints.headBottom?.y).toBeGreaterThan(22);
    expect(scale).toBeCloseTo(0.4 * 20);
  });

  it("leaves the head unplaced without both ears, and scales parts to the frame", () => {
    const { keyPoints, scale } = keyPointsOfPose(pose({ 2: [0.45, 0.2], 7: [0.4, 0.22] }), 100, 200);
    expect(keyPoints.headTop).toBeNull();
    expect(scale).toBeCloseTo(6);
  });
});

describe("MediaPipePoseModel", () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 2 }, videoHeight: { value: 1 } });

  it("loads the configured model size on the GPU, for the configured number of people", async () => {
    await new MediaPipePoseModel({ ...DEFAULT_APP_CONFIG, mediapipeVariant: "lite", visionMaxPeople: 3 }).load();
    expect(mediapipe.createFromOptions).toHaveBeenCalledWith(
      { wasmLoaderPath: "", wasmBinaryPath: "vision.wasm" },
      expect.objectContaining({
        baseOptions: expect.objectContaining({ delegate: "GPU", modelAssetPath: expect.stringContaining("lite") }),
        runningMode: "VIDEO",
        numPoses: 3,
        outputSegmentationMasks: true,
      }),
    );
  });

  it("turns each pose and its mask into a person, and releases the masks", async () => {
    const mask = confidenceMask([0.9, 0.2], 2);
    mediapipe.detectForVideo.mockReturnValue({ landmarks: [pose({})], segmentationMasks: [mask] });
    const model = new MediaPipePoseModel(DEFAULT_APP_CONFIG);
    await model.load();

    const frame = await model.detect(video, 5);

    expect(frame).toMatchObject({ width: 2, height: 1, timestamp: 5 });
    expect(Array.from(frame.people[0].mask)).toEqual([1, 0]);
    expect(mask.close).toHaveBeenCalled();
  });

  it("gives MediaPipe increasing timestamps, even if frames arrive with the same one", async () => {
    mediapipe.detectForVideo.mockReturnValue({ landmarks: [] });
    const model = new MediaPipePoseModel(DEFAULT_APP_CONFIG);
    await model.load();
    await model.detect(video, 10);
    await model.detect(video, 10);
    expect(mediapipe.detectForVideo.mock.calls.map(([, timestamp]) => timestamp)).toEqual([10, 11]);
  });

  it("reports the video's size for a frame with nobody in it", async () => {
    mediapipe.detectForVideo.mockReturnValue({ landmarks: [] });
    const model = new MediaPipePoseModel(DEFAULT_APP_CONFIG);
    await model.load();
    expect(await model.detect(video, 0)).toEqual({ width: 2, height: 1, timestamp: 0, people: [] });
  });

  it("refuses to detect before loading, and closes the landmarker on dispose", async () => {
    const model = new MediaPipePoseModel(DEFAULT_APP_CONFIG);
    await expect(model.detect(video, 0)).rejects.toThrow("not loaded");
    await model.load();
    model.dispose();
    expect(mediapipe.close).toHaveBeenCalledTimes(1);
  });
});
