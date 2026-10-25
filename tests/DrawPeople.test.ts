import { describe, expect, it } from "vitest";
import { silhouettePixels, tintPixels } from "../src/components/camera/DrawPeople";
import { BODY_PART_STYLES } from "../src/vision/BodyPart";
import { noKeyPoints, type KeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 4;
const HEIGHT = 1;

/** A person covering the given pixels of a 4×1 frame, with the given key points and no part radius. */
const person = (id: number, pixels: number[], keyPoints: Partial<KeyPoints> = {}): VisionPerson => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (const i of pixels) mask[i] = 1;
  return { id, mask, keyPoints: { ...noKeyPoints(), ...keyPoints }, scale: 0 };
};

const frame = (...people: VisionPerson[]): VisionFrame => ({ width: WIDTH, height: HEIGHT, timestamp: 0, people });

/** Each pixel's RGBA values. */
const rgba = (pixels: Uint8ClampedArray) =>
  Array.from({ length: pixels.length / 4 }, (_, i) => Array.from(pixels.slice(i * 4, i * 4 + 4)));

const { r, g, b, a } = BODY_PART_STYLES.leftHand.color;
const HAND = [r, g, b, a];
const CLEAR = [0, 0, 0, 0];

describe("silhouettePixels", () => {
  it("is opaque wherever anyone is, and clear elsewhere", () => {
    const alpha = rgba(silhouettePixels(frame(person(0, [0]), person(1, [2])))).map((pixel) => pixel[3]);
    expect(alpha).toEqual([255, 0, 255, 0]);
  });
});

describe("tintPixels", () => {
  const withHand = frame(person(0, [0, 1], { leftHand: { x: 1, y: 0 } }));

  it("tints only the hands and feet for extremities", () => {
    expect(rgba(tintPixels(withHand, "extremities"))).toEqual([CLEAR, HAND, CLEAR, CLEAR]);
  });

  it("tints the whole person, and the hand over it, for colored", () => {
    const [body, hand, outside] = rgba(tintPixels(withHand, "colored"));
    expect(body[3]).toBe(255);
    expect(body).not.toEqual(HAND);
    expect(hand).toEqual(HAND);
    expect(outside).toEqual(CLEAR);
  });

  it("tints each person differently for colored", () => {
    const [first, , second] = rgba(tintPixels(frame(person(0, [0]), person(1, [2])), "colored"));
    expect(first).not.toEqual(second);
  });

  it("leaves a part's key point unpainted where the silhouette isn't", () => {
    const offMask = frame(person(0, [0], { leftHand: { x: 3, y: 0 } }));
    expect(rgba(tintPixels(offMask, "extremities"))[3]).toEqual(CLEAR);
  });
});
