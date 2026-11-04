import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  feetOf,
  getCameraStream,
  maskRectForElement,
  screenPointForMaskPoint,
  type Rect,
  maskPointForScreenPoint,
} from "../src/components/camera/CameraSupport";
import { FakeMediaStream } from "./helpers/media";
import { stubGetUserMedia } from "./helpers/permissions";
import { noKeyPoints, type Point } from "../src/vision/VisionTypes";

const WIDTH = 10;
const HEIGHT = 100;

/** A person with only the given feet placed. */
const withFeet = (leftFoot: Point | null, rightFoot: Point | null) => ({
  keyPoints: { ...noKeyPoints(), leftFoot, rightFoot },
});

describe("maskPointForScreenPoint", () => {
  const canvas = { left: 100, top: 50, right: 300, bottom: 150 };
  const mask = { width: 20, height: 10 };

  it("scales a point on the canvas into the mask", () => {
    expect(maskPointForScreenPoint({ x: 200, y: 100 }, canvas, mask, false)).toEqual({ x: 10, y: 5 });
    expect(maskPointForScreenPoint({ x: 120, y: 60 }, canvas, mask, false)).toEqual({ x: 2, y: 1 });
  });

  it("flips it for a mirrored canvas", () => {
    expect(maskPointForScreenPoint({ x: 120, y: 60 }, canvas, mask, true)).toEqual({ x: 18, y: 1 });
  });

  it("gives a point off the canvas outside the mask", () => {
    expect(maskPointForScreenPoint({ x: 80, y: 60 }, canvas, mask, false).x).toBe(-2);
  });
});

describe("feetOf", () => {
  it("returns null when neither foot was placed", () => {
    expect(feetOf(withFeet(null, null), WIDTH, HEIGHT)).toBeNull();
  });

  it("is midway between the feet, at the lower foot's height", () => {
    const feet = feetOf(withFeet({ x: 2, y: 48 }, { x: 6, y: 50 }), WIDTH, HEIGHT);
    expect(feet).toEqual({ absolute: { x: 4, y: 50 }, percent: { x: 40, y: 50 } });
  });

  it("uses the one foot that was placed", () => {
    expect(feetOf(withFeet(null, { x: 5, y: 0 }), WIDTH, HEIGHT)?.absolute).toEqual({ x: 5, y: 0 });
  });

  it("returns null when the feet are below the off-screen threshold", () => {
    expect(feetOf(withFeet({ x: 5, y: 95 }, null), WIDTH, HEIGHT, 90)).toBeNull();
    expect(feetOf(withFeet({ x: 5, y: 85 }, null), WIDTH, HEIGHT, 90)?.absolute.y).toBe(85);
  });

  it("returns null for a frame with no size", () => {
    expect(feetOf(withFeet({ x: 0, y: 0 }, null), 0, 0)).toBeNull();
  });
});

describe("maskRectForElement", () => {
  /** A canvas 200 pixels wide and 100 tall, at (100, 50) in the viewport. */
  const canvas: Rect = { left: 100, top: 50, right: 300, bottom: 150 };
  const MASK_WIDTH = 400;
  const MASK_HEIGHT = 200;

  it("maps the whole canvas to the whole mask", () => {
    expect(maskRectForElement(canvas, canvas, { width: MASK_WIDTH, height: MASK_HEIGHT }, true)).toEqual({
      left: 0,
      top: 0,
      right: MASK_WIDTH,
      bottom: MASK_HEIGHT,
    });
  });

  it("mirrors x, so an element on the left of the screen covers the right of the mask", () => {
    expect(
      maskRectForElement(
        { left: 100, top: 50, right: 200, bottom: 150 },
        canvas,
        { width: MASK_WIDTH, height: MASK_HEIGHT },
        true,
      ),
    ).toEqual({ left: 200, top: 0, right: 400, bottom: 200 });
  });

  it("does not mirror y, so an element at the top covers the top of the mask", () => {
    expect(
      maskRectForElement(
        { left: 100, top: 50, right: 300, bottom: 100 },
        canvas,
        { width: MASK_WIDTH, height: MASK_HEIGHT },
        true,
      ),
    ).toEqual({ left: 0, top: 0, right: 400, bottom: 100 });
  });

  it("scales between the canvas's size and the mask's", () => {
    const smallCanvas: Rect = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(
      maskRectForElement({ left: 25, top: 20, right: 75, bottom: 80 }, smallCanvas, { width: 200, height: 50 }, true),
    ).toEqual({
      left: 50,
      top: 10,
      right: 150,
      bottom: 40,
    });
  });

  it("clamps an element that hangs off the canvas", () => {
    expect(
      maskRectForElement(
        { left: -50, top: 50, right: 200, bottom: 150 },
        canvas,
        { width: MASK_WIDTH, height: MASK_HEIGHT },
        true,
      ),
    ).toEqual({ left: 200, top: 0, right: 400, bottom: 200 });
  });

  it.each<[string, Rect]>([
    ["left", { left: 0, top: 50, right: 50, bottom: 100 }],
    ["right", { left: 350, top: 50, right: 400, bottom: 100 }],
    ["above", { left: 100, top: 0, right: 200, bottom: 40 }],
    ["below", { left: 100, top: 200, right: 200, bottom: 300 }],
  ])("returns an empty rectangle for an element entirely to the %s", (_where, element) => {
    expect(maskRectForElement(element, canvas, { width: MASK_WIDTH, height: MASK_HEIGHT }, true)).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  it("returns an empty rectangle for a canvas or mask with no size", () => {
    const none: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(maskRectForElement(canvas, none, { width: MASK_WIDTH, height: MASK_HEIGHT }, true)).toEqual(none);
    expect(maskRectForElement(canvas, canvas, { width: 0, height: MASK_HEIGHT }, true)).toEqual(none);
  });
});

describe("an unmirrored camera", () => {
  const canvas: Rect = { left: 100, top: 50, right: 300, bottom: 150 };

  it("keeps an element on the left of the screen on the left of the mask", () => {
    const element = { left: 100, top: 50, right: 200, bottom: 150 };
    expect(maskRectForElement(element, canvas, { width: 400, height: 200 }, false)).toEqual({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
    });
  });

  it("maps a mask point back to the screen without flipping it", () => {
    expect(screenPointForMaskPoint({ x: 0, y: 0 }, canvas, { width: 400, height: 200 }, false)).toEqual({
      x: 100.25,
      y: 50.25,
    });
  });

  it.each([false, true])("round trips an element's corner when mirrored is %s", (mirrored) => {
    const element = { left: 150, top: 75, right: 250, bottom: 125 };
    const rect = maskRectForElement(element, canvas, { width: 400, height: 200 }, mirrored);
    const { x, y } = screenPointForMaskPoint(
      { x: rect.left, y: rect.top },
      canvas,
      { width: 400, height: 200 },
      mirrored,
    );
    expect(x).toBeGreaterThanOrEqual(element.left);
    expect(x).toBeLessThanOrEqual(element.right);
    expect(y).toBeGreaterThanOrEqual(element.top);
    expect(y).toBeLessThanOrEqual(element.bottom);
  });
});

describe("getCameraStream", () => {
  let camera: ReturnType<typeof stubGetUserMedia>;

  beforeEach(() => {
    camera = stubGetUserMedia();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    camera.restore();
    vi.restoreAllMocks();
  });

  it("asks for the chosen camera and no other", async () => {
    await getCameraStream({ width: 640, height: 480 }, "rear");
    expect(camera.getUserMedia).toHaveBeenCalledExactlyOnceWith({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, deviceId: { exact: "rear" } },
    });
  });

  it("falls back to the system default when the chosen camera has gone", async () => {
    const stream = new FakeMediaStream();
    camera.getUserMedia.mockRejectedValueOnce(new DOMException("gone", "OverconstrainedError"));
    camera.getUserMedia.mockResolvedValueOnce(stream);
    await expect(getCameraStream(undefined, "rear")).resolves.toBe(stream);
    expect(camera.getUserMedia).toHaveBeenLastCalledWith({ video: true });
  });

  it("doesn't fall back to another camera when the chosen one is refused", async () => {
    camera.getUserMedia.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    await expect(getCameraStream(undefined, "rear")).rejects.toThrow("no");
    expect(camera.getUserMedia).toHaveBeenCalledOnce();
  });
});

describe("screenPointForMaskPoint", () => {
  /** A canvas 200 pixels wide and 100 tall, at (100, 50) in the viewport, showing a 400 by 200 mask. */
  const canvas: Rect = { left: 100, top: 50, right: 300, bottom: 150 };

  it("mirrors x and scales both axes, taking the centre of the pixel", () => {
    expect(screenPointForMaskPoint({ x: 0, y: 0 }, canvas, { width: 400, height: 200 }, true)).toEqual({
      x: 299.75,
      y: 50.25,
    });
    expect(screenPointForMaskPoint({ x: 399, y: 199 }, canvas, { width: 400, height: 200 }, true)).toEqual({
      x: 100.25,
      y: 149.75,
    });
  });

  it("lands inside the element whose mask rectangle holds the point", () => {
    const element: Rect = { left: 120, top: 60, right: 180, bottom: 100 };
    const rect = maskRectForElement(element, canvas, { width: 400, height: 200 }, true);
    const { x, y } = screenPointForMaskPoint({ x: rect.left, y: rect.top }, canvas, { width: 400, height: 200 }, true);
    expect(x).toBeGreaterThan(element.left);
    expect(x).toBeLessThan(element.right);
    expect(y).toBeGreaterThan(element.top);
    expect(y).toBeLessThan(element.bottom);
  });
});
