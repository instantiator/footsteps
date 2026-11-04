import { describe, expect, it } from "vitest";
import { silhouettePixels, staticGrid, staticPixels, tintPixels } from "../src/components/camera/DrawPeople";
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

describe("staticPixels", () => {
  const opaque = (pixels: Uint8ClampedArray) =>
    pixels.filter((_, index) => index % 4 === 3 && pixels[index] === 255).length;

  it("erases about the proportion asked", () => {
    expect(opaque(staticPixels(200, 100, 0.6, 7)) / 20_000).toBeCloseTo(0.6, 1);
    expect(opaque(staticPixels(200, 100, 0, 7))).toBe(0);
    expect(opaque(staticPixels(200, 100, 1, 7))).toBe(20_000);
  });

  it("gives the same pattern for the same seed, and another for another", () => {
    expect(staticPixels(20, 10, 0.5, 1)).toEqual(staticPixels(20, 10, 0.5, 1));
    expect(staticPixels(20, 10, 0.5, 1)).not.toEqual(staticPixels(20, 10, 0.5, 2));
  });

  it("keeps blocks erased as the proportion grows, so a held-still pattern only fills in", () => {
    const [less, more] = [staticPixels(20, 10, 0.3, 1), staticPixels(20, 10, 0.6, 1)];
    for (let i = 3; i < less.length; i += 4) if (less[i] === 255) expect(more[i]).toBe(255);
  });
});

describe("staticGrid", () => {
  it("sizes blocks as a % of the width, whatever the canvas's size, keeping them square", () => {
    expect(staticGrid(1280, 720, 0.5)).toEqual({ columns: 200, rows: 113 });
    expect(staticGrid(640, 360, 0.5)).toEqual({ columns: 200, rows: 113 });
    expect(staticGrid(1000, 1000, 10)).toEqual({ columns: 10, rows: 10 });
  });

  it("always has a block", () => {
    expect(staticGrid(100, 10, 1000)).toEqual({ columns: 1, rows: 1 });
  });
});

describe("tintPixels for a coloured mask", () => {
  it("picks the tint by the person's id, not where they are in the list", () => {
    const alone = rgba(tintPixels(frame(person(1, [0])), "colored"));
    const second = rgba(tintPixels(frame(person(0, [1]), person(1, [0])), "colored"));
    expect(alone[0]).toEqual(second[0]);
    expect(rgba(tintPixels(frame(person(0, [0])), "colored"))[0]).not.toEqual(alone[0]);
  });
});

describe("silhouettePixels", () => {
  it("is opaque wherever anyone is, and clear elsewhere", () => {
    const alpha = rgba(silhouettePixels(frame(person(0, [0]), person(1, [2])))).map((pixel) => pixel[3]);
    expect(alpha).toEqual([255, 0, 255, 0]);
  });

  it("draws a person's filled silhouette where the tracker filled one", () => {
    const filled = { ...person(0, [0]), filled: Uint8Array.from([1, 1, 0, 0]) };
    expect(rgba(silhouettePixels(frame(filled))).map((pixel) => pixel[3])).toEqual([255, 255, 0, 0]);
  });

  it("draws a held person as opaque as they are held, and overlaps at the more opaque", () => {
    const fading = { ...person(0, [0, 1]), held: { opacity: 0.5 } };
    const alpha = rgba(silhouettePixels(frame(fading, person(1, [1])))).map((pixel) => pixel[3]);
    expect(alpha).toEqual([128, 255, 0, 0]);
  });

  it("fills the buffer it is given, clearing the last frame's silhouette from it", () => {
    const buffer = silhouettePixels(frame(person(0, [0, 1])));
    const reused = silhouettePixels(frame(person(0, [3])), buffer);
    expect(reused).toBe(buffer);
    expect(rgba(reused).map((pixel) => pixel[3])).toEqual([0, 0, 0, 255]);
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

  it("fills the buffer it is given, clearing the last frame's tint from it", () => {
    const buffer = tintPixels(withHand, "colored");
    const reused = tintPixels(frame(person(0, [3])), "extremities", buffer);
    expect(reused).toBe(buffer);
    expect(rgba(reused)).toEqual([CLEAR, CLEAR, CLEAR, CLEAR]);
  });

  it("leaves a part's key point unpainted where the silhouette isn't", () => {
    const offMask = frame(person(0, [0], { leftHand: { x: 3, y: 0 } }));
    expect(rgba(tintPixels(offMask, "extremities"))[3]).toEqual(CLEAR);
  });
});
