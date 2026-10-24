import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import {
  extrapolate,
  keyPointsOfPose,
  MoveNetModel,
  posesFromOutput,
  skeletonOf,
} from "../src/vision/models/MoveNetModel";

/** The mocked libraries: MoveNet's raw output, and the selfie segmenter's mask. */
const libs = vi.hoisted(() => {
  class Tensor {
    readonly values: number[];
    constructor(values: number[]) {
      this.values = values;
    }
    async data() {
      return Float32Array.from(this.values);
    }
  }
  const state = { output: [] as number[], confidence: [] as number[], maskWidth: 2 };
  const predict = vi.fn(() => new Tensor(state.output));
  const segmentForVideo = vi.fn(() => ({
    confidenceMasks: [
      {
        width: state.maskWidth,
        height: state.confidence.length / state.maskWidth,
        getAsFloat32Array: () => Float32Array.from(state.confidence),
        close: vi.fn(),
      },
    ],
  }));
  const input = { expandDims: () => input, toInt: () => input };
  return {
    Tensor,
    state,
    predict,
    segmentForVideo,
    tf: {
      Tensor,
      tidy: <T>(fn: () => T) => fn(),
      dispose: vi.fn(),
      browser: { fromPixels: () => ({ shape: [480, 640, 3] }) },
      image: { resizeBilinear: vi.fn(() => input) },
      loadGraphModel: vi.fn(async () => ({ predict, dispose: vi.fn() })),
    },
    createFromOptions: vi.fn(async () => ({ segmentForVideo, close: vi.fn() })),
  };
});

vi.mock("@tensorflow/tfjs", () => libs.tf);
vi.mock("@mediapipe/tasks-vision", () => ({ ImageSegmenter: { createFromOptions: libs.createFromOptions } }));
vi.mock("../src/vision/models/TfBackend", () => ({ selectTfBackend: vi.fn(async () => "webgl") }));
vi.mock("../src/vision/models/MediaPipeAssets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/vision/models/MediaPipeAssets")>()),
  mediapipeWasm: vi.fn(async () => ({ wasmLoaderPath: "", wasmBinaryPath: "vision.wasm" })),
}));

/** One person's output row: every keypoint at (x, y) with the given score, unless overridden. */
const row = (score: number, keypoints: Record<number, [x: number, y: number, score?: number]> = {}): number[] => {
  const values = new Array<number>(56).fill(0);
  for (let k = 0; k < 17; k++) {
    const [x, y, s] = keypoints[k] ?? [0, 0, 0];
    values.splice(k * 3, 3, y, x, s ?? 0.9);
  }
  values[55] = score;
  return values;
};

beforeEach(() => {
  libs.state.output = [];
  libs.predict.mockClear();
  libs.tf.image.resizeBilinear.mockClear();
});

describe("posesFromOutput", () => {
  it("keeps confident people, scaled to the frame, and drops unconfident keypoints", () => {
    const output = [...row(0.9, { 0: [0.5, 0.25], 1: [0.1, 0.1, 0.1] }), ...row(0.1)];
    const [pose, ...others] = posesFromOutput(output, 200, 100);
    expect(others).toEqual([]);
    expect(pose[0]).toEqual({ x: 100, y: 25 });
    expect(pose[1]).toBeNull();
  });
});

describe("extrapolate", () => {
  it("continues the line past its end", () => {
    expect(extrapolate({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 15, y: 30 });
  });

  it("is the end without a start, and nothing without an end", () => {
    expect(extrapolate(null, { x: 1, y: 2 }, 0.5)).toEqual({ x: 1, y: 2 });
    expect(extrapolate({ x: 1, y: 2 }, null, 0.5)).toBeNull();
  });
});

describe("keyPointsOfPose", () => {
  it("places hands beyond the wrists and feet beyond the ankles", () => {
    const pose = Array.from({ length: 17 }, () => null as { x: number; y: number } | null);
    pose[7] = { x: 0, y: 0 }; // left elbow
    pose[9] = { x: 10, y: 0 }; // left wrist
    pose[14] = { x: 50, y: 50 }; // right knee
    pose[16] = { x: 50, y: 90 }; // right ankle
    const { keyPoints } = keyPointsOfPose(pose, 100);
    expect(keyPoints.leftHand).toEqual({ x: 13, y: 0 });
    expect(keyPoints.rightFoot).toEqual({ x: 50, y: 96 });
    expect(keyPoints.rightHand).toBeNull();
  });
});

describe("skeletonOf", () => {
  it("joins confident keypoints into limbs", () => {
    const pose = Array.from({ length: 17 }, () => null as { x: number; y: number } | null);
    pose[5] = { x: 1, y: 1 };
    pose[7] = { x: 2, y: 2 };
    expect(skeletonOf(pose)).toEqual([
      [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    ]);
  });

  it("falls back to lone keypoints when no limb is whole", () => {
    const pose = Array.from({ length: 17 }, () => null as { x: number; y: number } | null);
    pose[0] = { x: 3, y: 4 };
    expect(skeletonOf(pose)).toEqual([
      [
        { x: 3, y: 4 },
        { x: 3, y: 4 },
      ],
    ]);
  });
});

describe("MoveNetModel", () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 } });

  it("feeds MoveNet the frame at 256 on its longest side, in multiples of 32", async () => {
    [libs.state.maskWidth, libs.state.confidence] = [2, [0, 0]];
    const model = new MoveNetModel(DEFAULT_APP_CONFIG);
    await model.load();
    await model.detect(video, 0);
    expect(libs.tf.image.resizeBilinear).toHaveBeenCalledWith(expect.anything(), [192, 256]);
  });

  it("splits the selfie silhouette between the people MoveNet finds, up to the configured number", async () => {
    // A 4×1 mask, all person; one person's skeleton on its first pixel, the other's on its last
    libs.state.output = [
      ...row(0.9, { 5: [0, 0], 7: [0, 0] }),
      ...row(0.8, { 5: [0.75, 0], 7: [0.75, 0] }),
      ...row(0.7, { 5: [0.75, 0], 7: [0.75, 0] }),
    ];
    libs.state.maskWidth = 4;
    libs.state.confidence = [0.9, 0.9, 0.9, 0.9];
    const model = new MoveNetModel({ ...DEFAULT_APP_CONFIG, visionMaxPeople: 2 });
    await model.load();

    const frame = await model.detect(video, 7);

    expect(frame).toMatchObject({ width: 4, height: 1, timestamp: 7 });
    expect(frame.people.map(({ mask }) => Array.from(mask))).toEqual([
      [1, 1, 0, 0],
      [0, 0, 1, 1],
    ]);
  });

  it("refuses to detect before loading", async () => {
    await expect(new MoveNetModel(DEFAULT_APP_CONFIG).detect(video, 0)).rejects.toThrow("not loaded");
  });
});
