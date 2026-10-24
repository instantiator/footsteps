import type { PartSegmentation } from "@tensorflow-models/body-pix";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import { BodyPixModel, personFromParts } from "../src/vision/models/BodyPixModel";

/** The mocked BodyPix library. */
const bodyPix = vi.hoisted(() => {
  const segmentMultiPersonParts = vi.fn();
  const dispose = vi.fn();
  const load = vi.fn(async () => ({ segmentMultiPersonParts, dispose }));
  return { load, segmentMultiPersonParts, dispose };
});

vi.mock("@tensorflow-models/body-pix", () => ({ load: bodyPix.load }));
vi.mock("@tensorflow/tfjs", () => ({ ready: vi.fn(async () => undefined), Tensor: class {}, browser: {} }));

/** BodyPix's ids for the parts used here. */
const LEFT_FACE = 0;
const RIGHT_FACE = 1;
const LEFT_HAND = 10;
const RIGHT_FOOT = 23;
const TORSO = 12;

/** A part segmentation of the given size, background (-1) except for the given (x, y, part) pixels. */
const segmentation = (width: number, height: number, pixels: [number, number, number][]): PartSegmentation => {
  const data = new Int32Array(width * height).fill(-1);
  for (const [x, y, part] of pixels) data[y * width + x] = part;
  return { data, width, height, pose: { keypoints: [], score: 1 } };
};

beforeEach(() => {
  bodyPix.load.mockClear();
  bodyPix.segmentMultiPersonParts.mockReset();
  bodyPix.dispose.mockReset();
});

describe("personFromParts", () => {
  it("makes the silhouette from every non-background pixel", () => {
    const person = personFromParts(
      3,
      segmentation(3, 1, [
        [0, 0, TORSO],
        [2, 0, LEFT_HAND],
      ]),
    );
    expect(person.id).toBe(3);
    expect(Array.from(person.mask)).toEqual([1, 0, 1]);
  });

  it("places hands and feet at the centre of their pixels, and leaves missing ones unplaced", () => {
    const { keyPoints } = personFromParts(
      0,
      segmentation(10, 10, [
        [2, 2, LEFT_HAND],
        [4, 4, LEFT_HAND],
        [7, 9, RIGHT_FOOT],
      ]),
    );
    expect(keyPoints.leftHand).toEqual({ x: 3, y: 3 });
    expect(keyPoints.rightFoot).toEqual({ x: 7, y: 9 });
    expect(keyPoints.rightHand).toBeNull();
    expect(keyPoints.leftFoot).toBeNull();
  });

  it("places the head at the face's extremes, its own left on the image's right, and scales parts to it", () => {
    const { keyPoints, scale } = personFromParts(
      0,
      segmentation(10, 10, [
        [2, 1, RIGHT_FACE],
        [6, 3, LEFT_FACE],
        [4, 5, LEFT_FACE],
      ]),
    );
    expect(keyPoints.headTop).toEqual({ x: 4, y: 1 });
    expect(keyPoints.headBottom).toEqual({ x: 4, y: 5 });
    expect(keyPoints.headLeft).toEqual({ x: 6, y: 3 });
    expect(keyPoints.headRight).toEqual({ x: 2, y: 3 });
    expect(scale).toBeCloseTo(0.4 * 5);
  });

  it("scales parts to the frame when there is no face", () => {
    const { keyPoints, scale } = personFromParts(0, segmentation(10, 100, [[1, 1, TORSO]]));
    expect(keyPoints.headTop).toBeNull();
    expect(scale).toBeCloseTo(3);
  });
});

describe("BodyPixModel", () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 3 }, videoHeight: { value: 1 } });

  it("loads ResNet50 with the configured stride and weights", async () => {
    await new BodyPixModel({ ...DEFAULT_APP_CONFIG, bodypixOutputStride: 32, bodypixQuantBytes: 4 }).load();
    expect(bodyPix.load).toHaveBeenCalledWith({
      architecture: "ResNet50",
      outputStride: 32,
      multiplier: 1,
      quantBytes: 4,
    });
  });

  it("uses stride 16 for ResNet50 when 8 is asked for, as ResNet50 has no stride 8", async () => {
    await new BodyPixModel({ ...DEFAULT_APP_CONFIG, bodypixOutputStride: 8 }).load();
    expect(bodyPix.load).toHaveBeenCalledWith(expect.objectContaining({ outputStride: 16 }));
  });

  it("loads MobileNetV1 at a 0.75 multiplier, keeping stride 8", async () => {
    await new BodyPixModel({
      ...DEFAULT_APP_CONFIG,
      bodypixArchitecture: "MobileNetV1",
      bodypixOutputStride: 8,
    }).load();
    expect(bodyPix.load).toHaveBeenCalledWith(expect.objectContaining({ outputStride: 8, multiplier: 0.75 }));
  });

  it("segments each person separately, up to the configured number", async () => {
    bodyPix.segmentMultiPersonParts.mockResolvedValue([
      segmentation(3, 1, [[0, 0, TORSO]]),
      segmentation(3, 1, [[2, 0, TORSO]]),
    ]);
    const model = new BodyPixModel({ ...DEFAULT_APP_CONFIG, visionMaxPeople: 3 });
    await model.load();

    const frame = await model.detect(video, 42);

    expect(bodyPix.segmentMultiPersonParts).toHaveBeenCalledWith(video, {
      internalResolution: DEFAULT_APP_CONFIG.bodypixInternalResolution,
      segmentationThreshold: DEFAULT_APP_CONFIG.bodypixThreshold,
      maxDetections: 3,
    });
    expect(frame).toMatchObject({ width: 3, height: 1, timestamp: 42 });
    expect(frame.people.map(({ id, mask }) => [id, Array.from(mask)])).toEqual([
      [0, [1, 0, 0]],
      [1, [0, 0, 1]],
    ]);
  });

  it("reports the video's size for a frame with nobody in it", async () => {
    bodyPix.segmentMultiPersonParts.mockResolvedValue([]);
    const model = new BodyPixModel(DEFAULT_APP_CONFIG);
    await model.load();
    expect(await model.detect(video, 0)).toEqual({ width: 3, height: 1, timestamp: 0, people: [] });
  });

  it("refuses to detect before loading, and releases the model on dispose", async () => {
    const model = new BodyPixModel(DEFAULT_APP_CONFIG);
    await expect(model.detect(video, 0)).rejects.toThrow("not loaded");
    await model.load();
    model.dispose();
    expect(bodyPix.dispose).toHaveBeenCalledTimes(1);
    await expect(model.detect(video, 0)).rejects.toThrow("not loaded");
  });
});
