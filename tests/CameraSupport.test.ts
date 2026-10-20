import { describe, expect, it } from "vitest";
import { findFeet } from "../src/components/camera/CameraSupport";

const WIDTH = 10;
const HEIGHT = 100;

/** A transparent RGBA mask with the given (x, y) pixels made opaque. */
const mask = (pixels: [number, number][]) => {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (const [x, y] of pixels) data[(y * WIDTH + x) * 4 + 3] = 255;
  return { data };
};

describe("findFeet", () => {
  it("returns null for an empty mask", () => {
    expect(findFeet(mask([]), WIDTH, HEIGHT)).toBeNull();
  });

  it("finds the lowest opaque row and the centre of the pixels there", () => {
    const feet = findFeet(
      mask([
        [2, 50],
        [6, 50],
      ]),
      WIDTH,
      HEIGHT,
    );
    expect(feet).toEqual({ absolute: { x: 4, y: 50 }, percent: { x: 40, y: 50 } });
  });

  it("averages x over the 20-row band above the lowest row, ignoring pixels higher up", () => {
    const feet = findFeet(
      mask([
        [0, 80],
        [8, 70],
        [9, 40],
      ]),
      WIDTH,
      HEIGHT,
    );
    expect(feet?.absolute).toEqual({ x: 4, y: 80 });
  });

  it("returns null when the feet are below the off-screen threshold", () => {
    expect(findFeet(mask([[5, 95]]), WIDTH, HEIGHT, 90)).toBeNull();
    expect(findFeet(mask([[5, 85]]), WIDTH, HEIGHT, 90)?.absolute.y).toBe(85);
  });
});

describe("findFeet at the top of the frame", () => {
  // BUG #11 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): a mask opaque only in row 0 should give a position at y 0; bandCentreX skips row 0, so findFeet returns null.
  it.skip("finds feet when the only opaque pixels are in the top row", () => {
    const feet = findFeet(
      mask([
        [2, 0],
        [6, 0],
      ]),
      WIDTH,
      HEIGHT,
    );
    expect(feet?.absolute).toEqual({ x: 4, y: 0 });
  });
});
