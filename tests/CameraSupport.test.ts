import { describe, expect, it } from "vitest";
import { feetOf, maskRectForElement, type Rect } from "../src/components/camera/CameraSupport";
import { noKeyPoints, type Point } from "../src/vision/VisionTypes";

const WIDTH = 10;
const HEIGHT = 100;

/** A person with only the given feet placed. */
const withFeet = (leftFoot: Point | null, rightFoot: Point | null) => ({
  keyPoints: { ...noKeyPoints(), leftFoot, rightFoot },
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
    expect(maskRectForElement(canvas, canvas, MASK_WIDTH, MASK_HEIGHT)).toEqual({
      left: 0,
      top: 0,
      right: MASK_WIDTH,
      bottom: MASK_HEIGHT,
    });
  });

  it("mirrors x, so an element on the left of the screen covers the right of the mask", () => {
    expect(
      maskRectForElement({ left: 100, top: 50, right: 200, bottom: 150 }, canvas, MASK_WIDTH, MASK_HEIGHT),
    ).toEqual({ left: 200, top: 0, right: 400, bottom: 200 });
  });

  it("does not mirror y, so an element at the top covers the top of the mask", () => {
    expect(
      maskRectForElement({ left: 100, top: 50, right: 300, bottom: 100 }, canvas, MASK_WIDTH, MASK_HEIGHT),
    ).toEqual({ left: 0, top: 0, right: 400, bottom: 100 });
  });

  it("scales between the canvas's size and the mask's", () => {
    const smallCanvas: Rect = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(maskRectForElement({ left: 25, top: 20, right: 75, bottom: 80 }, smallCanvas, 200, 50)).toEqual({
      left: 50,
      top: 10,
      right: 150,
      bottom: 40,
    });
  });

  it("clamps an element that hangs off the canvas", () => {
    expect(
      maskRectForElement({ left: -50, top: 50, right: 200, bottom: 150 }, canvas, MASK_WIDTH, MASK_HEIGHT),
    ).toEqual({ left: 200, top: 0, right: 400, bottom: 200 });
  });

  it.each<[string, Rect]>([
    ["left", { left: 0, top: 50, right: 50, bottom: 100 }],
    ["right", { left: 350, top: 50, right: 400, bottom: 100 }],
    ["above", { left: 100, top: 0, right: 200, bottom: 40 }],
    ["below", { left: 100, top: 200, right: 200, bottom: 300 }],
  ])("returns an empty rectangle for an element entirely to the %s", (_where, element) => {
    expect(maskRectForElement(element, canvas, MASK_WIDTH, MASK_HEIGHT)).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  it("returns an empty rectangle for a canvas or mask with no size", () => {
    const none: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(maskRectForElement(canvas, none, MASK_WIDTH, MASK_HEIGHT)).toEqual(none);
    expect(maskRectForElement(canvas, canvas, 0, MASK_HEIGHT)).toEqual(none);
  });
});
