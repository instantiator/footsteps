import { describe, expect, it } from "vitest";
import {
  cropAspect,
  cropPlacement,
  DEFAULT_CORNERS,
  dragCorner,
  floorCrop,
  floorHomography,
  floorToViewport,
  floorWidthRatio,
  placeOnFloor,
  screenFloorForImage,
  viewportToFloor,
  type FloorView,
  isOnFloor,
  isValidFloor,
  maskPointForScreenPoint,
  maskRectForElement,
  screenPointForMaskPoint,
  type Corners,
  type Rect,
} from "../src/components/camera/FloorGeometry";
import type { Point } from "../src/vision/VisionTypes";

/** A camera that isn't centred on the play space: every corner placed differently. */
const LOPSIDED: Corners = {
  backLeft: { x: 0.3, y: 0.4 },
  backRight: { x: 0.65, y: 0.5 },
  frontRight: { x: 0.97, y: 0.95 },
  frontLeft: { x: 0.12, y: 0.8 },
};

/** The smallest area anyone might calibrate: a sliver of floor. */
const SLIVER: Corners = {
  backLeft: { x: 0.48, y: 0.6 },
  backRight: { x: 0.52, y: 0.6 },
  frontRight: { x: 0.53, y: 0.63 },
  frontLeft: { x: 0.47, y: 0.63 },
};

const close = (actual: Point, expected: Point) => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
};

describe("floorHomography", () => {
  it.each([
    ["the defaults", DEFAULT_CORNERS],
    ["a lopsided floor", LOPSIDED],
    ["a sliver", SLIVER],
  ])("maps the floor's corners to %s, and back", (_, corners) => {
    const { toImage, toFloor } = floorHomography(corners);
    const floorCorners: [keyof Corners, Point][] = [
      ["backLeft", { x: 0, y: 0 }],
      ["backRight", { x: 100, y: 0 }],
      ["frontRight", { x: 100, y: 100 }],
      ["frontLeft", { x: 0, y: 100 }],
    ];
    for (const [name, floor] of floorCorners) {
      close(toImage(floor), corners[name]);
      close(toFloor(corners[name]), floor);
    }
  });

  it.each([DEFAULT_CORNERS, LOPSIDED, SLIVER])("round trips points inside the floor", (corners) => {
    const { toImage, toFloor } = floorHomography(corners);
    for (const floor of [
      { x: 50, y: 50 },
      { x: 10, y: 90 },
      { x: 75, y: 20 },
    ])
      close(toFloor(toImage(floor)), floor);
  });

  it("bunches rows towards the back, as on camera", () => {
    const halfway = floorHomography(DEFAULT_CORNERS).toImage({ x: 50, y: 50 });
    expect(halfway.y).toBeLessThan((DEFAULT_CORNERS.backLeft.y + DEFAULT_CORNERS.frontLeft.y) / 2);
  });
});

describe("isValidFloor", () => {
  it.each([DEFAULT_CORNERS, LOPSIDED, SLIVER])("accepts a convex floor", (corners) => {
    expect(isValidFloor(corners)).toBe(true);
  });

  it("rejects a concave floor", () => {
    expect(isValidFloor({ ...DEFAULT_CORNERS, backRight: { x: 0.6, y: 0.8 } })).toBe(false);
  });

  it("rejects a floor whose edges cross", () => {
    expect(
      isValidFloor({
        ...DEFAULT_CORNERS,
        frontRight: DEFAULT_CORNERS.frontLeft,
        frontLeft: DEFAULT_CORNERS.frontRight,
      }),
    ).toBe(false);
  });

  it("rejects a floor with the back in front", () => {
    const { backLeft, backRight, frontRight, frontLeft } = DEFAULT_CORNERS;
    expect(
      isValidFloor({ backLeft: frontLeft, backRight: frontRight, frontRight: backRight, frontLeft: backLeft }),
    ).toBe(false);
  });

  it("rejects a corner outside the image", () => {
    expect(isValidFloor({ ...DEFAULT_CORNERS, frontLeft: { x: -0.1, y: 0.9 } })).toBe(false);
  });
});

describe("dragCorner", () => {
  it("moves a corner exactly where a valid drag takes it", () => {
    expect(dragCorner(DEFAULT_CORNERS, "backLeft", { x: 0.2, y: 0.5 }).backLeft).toEqual({ x: 0.2, y: 0.5 });
  });

  it("stops a drag that would make the floor concave at the limit", () => {
    const dragged = dragCorner(DEFAULT_CORNERS, "backRight", { x: 0.3, y: 0.95 });
    expect(isValidFloor(dragged)).toBe(true);
    expect(dragged.backRight).not.toEqual(DEFAULT_CORNERS.backRight);
    // A little further along the drag is no longer a floor
    const { x, y } = dragged.backRight;
    expect(isValidFloor({ ...dragged, backRight: { x: x - 0.01 * 0.45, y: y + 0.01 * 0.4 } })).toBe(false);
  });

  it("keeps a corner inside the image", () => {
    expect(dragCorner(DEFAULT_CORNERS, "frontLeft", { x: -0.5, y: 1.5 }).frontLeft).toEqual({ x: 0, y: 1 });
  });
});

describe("floorCrop", () => {
  it("spans the floor's width, down to its lowest point", () => {
    expect(floorCrop(DEFAULT_CORNERS)).toEqual({ left: 0.08, right: 0.92, bottom: 0.9 });
  });

  it("uses the lowest corner when the front edge slants", () => {
    expect(floorCrop(LOPSIDED)).toEqual({ left: 0.12, right: 0.97, bottom: 0.95 });
  });

  it("gives the defaults on a 4:3 camera a view a little squarer than the camera's", () => {
    expect(cropAspect(floorCrop(DEFAULT_CORNERS), 4 / 3)).toBeCloseTo(1.244, 3);
  });
});

describe("isOnFloor", () => {
  it("is true inside the floor and false outside it", () => {
    expect(isOnFloor(DEFAULT_CORNERS, { x: 0.5, y: 0.7 })).toBe(true);
    expect(isOnFloor(DEFAULT_CORNERS, { x: 0.5, y: 0.95 })).toBe(false);
    expect(isOnFloor(DEFAULT_CORNERS, { x: 0.15, y: 0.6 })).toBe(false);
    expect(isOnFloor(DEFAULT_CORNERS, { x: 0.5, y: 0.2 })).toBe(false);
  });
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

describe("floor and viewport", () => {
  const view = (mirrored: boolean, corners: Corners = DEFAULT_CORNERS): FloorView => ({
    corners,
    crop: cropPlacement(floorCrop(corners), mirrored),
    mirrored,
  });
  const viewport = { width: 1240, height: 1000 };

  it.each([false, true])("goes from the floor to the viewport and back (mirrored: %s)", (mirrored) => {
    for (const floor of [
      { x: 0, y: 0 },
      { x: 30, y: 70 },
      { x: 100, y: 100 },
    ]) {
      const back = viewportToFloor(view(mirrored, LOPSIDED), floorToViewport(view(mirrored, LOPSIDED), floor));
      expect(back.x).toBeCloseTo(floor.x);
      expect(back.y).toBeCloseTo(floor.y);
    }
  });

  it("puts the front corners on the viewport's bottom corners, and the back inside it", () => {
    const at = (floor: Point) => floorToViewport(view(false), floor);
    expect(at({ x: 0, y: 100 }).x).toBeCloseTo(0);
    expect(at({ x: 0, y: 100 }).y).toBeCloseTo(1);
    expect(at({ x: 100, y: 100 }).x).toBeCloseTo(1);
    expect(at({ x: 0, y: 0 }).x).toBeCloseTo((0.25 - 0.08) / 0.84);
    expect(at({ x: 0, y: 0 }).y).toBeCloseTo(0.55 / 0.9);
  });

  it("keeps floor x 0 on the screen's left when mirrored", () => {
    const left = floorToViewport(view(true, LOPSIDED), { x: 0, y: 100 });
    const right = floorToViewport(view(true, LOPSIDED), { x: 100, y: 100 });
    expect(left.x).toBeLessThan(right.x);
    expect(screenFloorForImage(LOPSIDED, LOPSIDED.frontRight, true).x).toBeCloseTo(0);
  });

  it("scales by the floor's width at that depth, relative to the front", () => {
    expect(floorWidthRatio(view(false), viewport, 100)).toBeCloseTo(1);
    expect(floorWidthRatio(view(false), viewport, 0)).toBeCloseTo(0.5 / 0.84);
    expect(floorWidthRatio(view(true), viewport, 0)).toBeCloseTo(0.5 / 0.84);
  });

  it("moves an item's anchor onto its floor spot, raised by its height at that depth", () => {
    const anchor = { x: 100, y: 200 };
    const flat = placeOnFloor(view(false), viewport, anchor, { floor: { x: 50, y: 100 }, height: 0 });
    expect(flat.translate.x).toBeCloseTo(620 - 100);
    expect(flat.translate.y).toBeCloseTo(1000 - 200);
    expect(flat.scale).toBeCloseTo(1);

    const back = placeOnFloor(view(false), viewport, anchor, { floor: { x: 50, y: 0 }, height: 10 });
    const ground = placeOnFloor(view(false), viewport, anchor, { floor: { x: 50, y: 0 }, height: 0 });
    expect(back.scale).toBeCloseTo(0.5 / 0.84);
    // 10 units of a row that is 0.5 / 0.84 of the 1240 px front edge
    expect(ground.translate.y - back.translate.y).toBeCloseTo(0.1 * 1240 * (0.5 / 0.84));
  });
});
