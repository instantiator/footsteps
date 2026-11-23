import { describe, expect, it } from "vitest";
import { handsOf, type HandPixel } from "../src/vision/HandClumps";

/** A square of hand pixels around a centre, `lefts` of them labelled left and the rest right. */
const square = (cx: number, cy: number, lefts: number): HandPixel[] =>
  Array.from({ length: 25 }, (_, i) => ({ x: cx - 2 + (i % 5), y: cy - 2 + Math.floor(i / 5), left: i < lefts }));

describe("handsOf", () => {
  it("finds nothing in no pixels", () => {
    expect(handsOf([], 30)).toEqual({ leftHand: null, rightHand: null });
  });

  it("names two clumps by most of their labels", () => {
    expect(handsOf([...square(100, 50, 20), ...square(300, 60, 5)], 30)).toEqual({
      leftHand: { x: 100, y: 50 },
      rightHand: { x: 300, y: 60 },
    });
  });

  it("gives two clumps different names even when both are labelled the same", () => {
    const hands = handsOf([...square(100, 50, 25), ...square(300, 60, 15)], 30);
    expect(hands).toEqual({ leftHand: { x: 100, y: 50 }, rightHand: { x: 300, y: 60 } });
  });

  it("finds two hands, not a point between them, when one label covers both", () => {
    const hands = handsOf([...square(100, 50, 25), ...square(300, 50, 25)], 30);
    expect([hands.leftHand?.x, hands.rightHand?.x].sort()).toEqual([100, 300]);
  });

  it("takes clumps nearer than the gap as one hand, named by most of the labels", () => {
    expect(handsOf([...square(100, 50, 5), ...square(110, 50, 5)], 30)).toEqual({
      leftHand: null,
      rightHand: { x: 105, y: 50 },
    });
  });
});
