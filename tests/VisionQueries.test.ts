import { describe, expect, it } from "vitest";
import { BodyPart } from "../src/vision/BodyPart";
import {
  bodyPartsAt,
  bodyPartsIn,
  partRegion,
  splitMaskByNearestSkeleton,
  type Segment,
} from "../src/vision/VisionQueries";
import { noKeyPoints, type KeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 20;
const HEIGHT = 20;

/** A person whose mask fills the given rectangle, with the given key points and part radius. */
const person = (
  id: number,
  [left, top, right, bottom]: [number, number, number, number],
  keyPoints: Partial<KeyPoints> = {},
  scale = 2,
): VisionPerson => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) mask[y * WIDTH + x] = 1;
  return { id, mask, keyPoints: { ...noKeyPoints(), ...keyPoints }, scale };
};

const frame = (...people: VisionPerson[]): VisionFrame => ({ width: WIDTH, height: HEIGHT, timestamp: 0, people });

/** A person filling the frame, with a left hand at (10, 10). */
const handPerson = (id = 0) => person(id, [0, 0, WIDTH, HEIGHT], { leftHand: { x: 10, y: 10 } });

describe("bodyPartsAt", () => {
  it("finds the hand and the body at a point in the hand's region", () => {
    expect(bodyPartsAt(frame(handPerson()), { x: 11, y: 10 })).toEqual([
      { personId: 0, part: BodyPart.BODY },
      { personId: 0, part: BodyPart.LEFT_HAND },
    ]);
  });

  it("finds only the body away from every key point", () => {
    expect(bodyPartsAt(frame(handPerson()), { x: 1, y: 1 })).toEqual([{ personId: 0, part: BodyPart.BODY }]);
  });

  it("finds nothing outside the silhouette, even within a part's radius", () => {
    const narrow = person(0, [10, 0, 11, HEIGHT], { leftHand: { x: 10, y: 10 } });
    expect(bodyPartsAt(frame(narrow), { x: 11, y: 10 })).toEqual([]);
  });

  it("finds both people where they overlap", () => {
    const parts = bodyPartsAt(frame(handPerson(0), handPerson(1)), { x: 10, y: 10 });
    expect(parts.filter(({ part }) => part === BodyPart.LEFT_HAND).map(({ personId }) => personId)).toEqual([0, 1]);
  });

  it("finds nothing off the frame", () => {
    expect(bodyPartsAt(frame(handPerson()), { x: -1, y: 5 })).toEqual([]);
    expect(bodyPartsAt(frame(handPerson()), { x: 5, y: HEIGHT })).toEqual([]);
  });
});

describe("bodyPartsIn", () => {
  const handIn = (area: { left: number; top: number; right: number; bottom: number }) =>
    bodyPartsIn(frame(handPerson()), area).find(({ part }) => part === BodyPart.LEFT_HAND)?.proportion;

  it("reports all of a hand inside an area that covers it", () => {
    expect(handIn({ left: 0, top: 0, right: WIDTH, bottom: HEIGHT })).toBe(1);
  });

  it("reports half of a hand split down its middle, less its centre column", () => {
    // The disc of radius 2 has 13 pixels: 5 in its centre column, 4 either side
    expect(handIn({ left: 11, top: 0, right: WIDTH, bottom: HEIGHT })).toBeCloseTo(4 / 13);
  });

  it("omits a hand with no pixels inside the area", () => {
    expect(handIn({ left: 0, top: 0, right: 5, bottom: 5 })).toBeUndefined();
  });

  it("clips a hand at the edge of the frame", () => {
    const corner = person(0, [0, 0, WIDTH, HEIGHT], { rightFoot: { x: 0, y: 0 } });
    const [foot] = bodyPartsIn(frame(corner), { left: 0, top: 0, right: 1, bottom: 1 }).filter(
      ({ part }) => part === BodyPart.RIGHT_FOOT,
    );
    // Only the quarter disc inside the frame counts: (0,0), (1,0), (2,0), (0,1), (1,1), (0,2)
    expect(foot.proportion).toBeCloseTo(1 / 6);
  });

  it("measures the head as the box its extremes span", () => {
    const head = person(0, [0, 0, WIDTH, HEIGHT], {
      headTop: { x: 5, y: 2 },
      headBottom: { x: 5, y: 5 },
      headLeft: { x: 3, y: 3 },
      headRight: { x: 6, y: 3 },
    });
    const [found] = bodyPartsIn(frame(head), { left: 0, top: 0, right: 5, bottom: 20 }).filter(
      ({ part }) => part === BodyPart.HEAD,
    );
    expect(found.proportion).toBe(0.5); // columns 3–4 of 3–6
  });

  it("reports the whole body as a fraction of the silhouette", () => {
    const [body] = bodyPartsIn(frame(person(0, [0, 0, 10, 10])), { left: 0, top: 0, right: 5, bottom: 10 });
    expect(body).toEqual({ personId: 0, part: BodyPart.BODY, proportion: 0.5 });
  });
});

describe("partRegion", () => {
  it("has no region for a part the model did not place", () => {
    const placed = person(0, [0, 0, WIDTH, HEIGHT], { headTop: { x: 1, y: 1 } });
    expect(partRegion(placed, BodyPart.LEFT_FOOT, WIDTH, HEIGHT)).toBeNull();
    expect(partRegion(placed, BodyPart.HEAD, WIDTH, HEIGHT)).toBeNull(); // needs all four extremes
  });
});

describe("splitMaskByNearestSkeleton", () => {
  const full = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const left: Segment[] = [
    [
      { x: 3, y: 2 },
      { x: 3, y: 18 },
    ],
  ];
  const right: Segment[] = [
    [
      { x: 15, y: 2 },
      { x: 15, y: 18 },
    ],
  ];

  it("gives everything to the only person", () => {
    const [mask] = splitMaskByNearestSkeleton(full, WIDTH, [left]);
    expect(mask).toEqual(full);
  });

  it("gives nothing when nobody's skeleton was found", () => {
    expect(splitMaskByNearestSkeleton(full, WIDTH, [])).toEqual([]);
  });

  it("gives each pixel to the nearer skeleton, and every pixel to exactly one person", () => {
    const [a, b] = splitMaskByNearestSkeleton(full, WIDTH, [left, right]);
    expect(a[10 * WIDTH + 8]).toBe(1); // nearer the left skeleton
    expect(b[10 * WIDTH + 10]).toBe(1); // nearer the right skeleton
    expect(a[10 * WIDTH + 10]).toBe(0);
    for (let i = 0; i < full.length; i++) expect(a[i] + b[i]).toBe(1);
  });

  it("leaves background pixels out of every mask", () => {
    const sparse = new Uint8Array(WIDTH * HEIGHT);
    sparse[5] = 1;
    const masks = splitMaskByNearestSkeleton(sparse, WIDTH, [left, right]);
    expect(masks.map((mask) => mask.reduce((sum, value) => sum + value, 0))).toEqual([1, 0]);
  });
});
