import { describe, expect, it } from "vitest";
import { keepMainBody } from "../src/vision/MaskComponents";

const SETTINGS = { minShare: 0.05, maxGap: 0.1 };

/** A 100×100 part map, background except for the given rectangles of part 12 (a torso). */
const partsWith = (...boxes: [number, number, number, number][]): Int32Array => {
  const parts = new Int32Array(100 * 100).fill(-1);
  for (const [left, top, right, bottom] of boxes)
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) parts[y * 100 + x] = 12;
  return parts;
};

const count = (parts: Int32Array) => parts.filter((part) => part >= 0).length;

describe("keepMainBody", () => {
  it("leaves a single body as it is, with no strays", () => {
    const parts = partsWith([40, 10, 60, 90]);
    const { parts: kept, strays } = keepMainBody(parts, 100, SETTINGS);
    expect(kept).toBe(parts);
    expect(strays).toBeNull();
  });

  it("removes a patch far from the body, and notes where it was", () => {
    const { parts: kept, strays } = keepMainBody(partsWith([40, 10, 60, 90], [2, 95, 6, 99]), 100, SETTINGS);
    expect(count(kept)).toBe(20 * 80);
    expect(strays?.[97 * 100 + 3]).toBe(1);
    expect(strays?.[50 * 100 + 50]).toBe(0);
  });

  it("removes a patch near the body that is too small to be part of it", () => {
    const { parts: kept } = keepMainBody(partsWith([40, 10, 60, 90], [62, 50, 64, 52]), 100, SETTINGS);
    expect(count(kept)).toBe(20 * 80);
  });

  it("keeps a hand the model separated from the arm by a thin gap", () => {
    const { parts: kept, strays } = keepMainBody(partsWith([40, 10, 60, 90], [63, 40, 73, 50]), 100, SETTINGS);
    expect(count(kept)).toBe(20 * 80 + 10 * 10);
    expect(strays).toBeNull();
  });

  it("keeps every patch when the settings allow any size at any distance", () => {
    const parts = partsWith([40, 10, 60, 90], [2, 95, 6, 99]);
    expect(keepMainBody(parts, 100, { minShare: 0, maxGap: 1 }).strays).toBeNull();
  });
});
