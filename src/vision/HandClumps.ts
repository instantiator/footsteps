/**
 * Hands from a segmenter's hand pixels, whatever their left and right labels say. BodyPix often mixes those labels,
 * worst from behind (camera session 1, F5): both points land on one hand, a label hops to the other hand, or one label
 * covers both and its centre lands between them. Where the pixels are is reliable, so they are split into two clumps,
 * and only the naming uses the labels.
 */
import _ from "lodash";
import type { KeyPoints, Point } from "./VisionTypes";

/** A pixel labelled as a hand. */
export interface HandPixel {
  /** Its column. */
  x: number;
  /** Its row. */
  y: number;
  /** Whether the segmenter called it the left hand. */
  left: boolean;
}

/** Rounds of 2-means: hand pixels settle into their two clumps within a few. */
const ROUNDS = 5;

/** The mean of some pixels, rounded, and how many of them say left rather than right. */
const summary = (pixels: HandPixel[]): { centre: Point; votes: number } => {
  let [x, y, votes] = [0, 0, 0];
  for (const pixel of pixels) {
    x += pixel.x;
    y += pixel.y;
    votes += pixel.left ? 1 : -1;
  }
  return { centre: { x: Math.round(x / pixels.length), y: Math.round(y / pixels.length) }, votes };
};

/** The pixels split between two centres, each to the nearer, by 2-means from the leftmost and rightmost pixels. */
const twoClumps = (pixels: HandPixel[]): [HandPixel[], HandPixel[]] => {
  let centres: Point[] = [_.minBy(pixels, "x") ?? pixels[0], _.maxBy(pixels, "x") ?? pixels[0]];
  let clumps: [HandPixel[], HandPixel[]] = [pixels, []];
  for (let round = 0; round < ROUNDS; round++) {
    const near = (pixel: HandPixel, centre: Point) => (pixel.x - centre.x) ** 2 + (pixel.y - centre.y) ** 2;
    clumps = [[], []];
    for (const pixel of pixels) clumps[near(pixel, centres[0]) <= near(pixel, centres[1]) ? 0 : 1].push(pixel);
    if (clumps[1].length === 0) break;
    centres = clumps.map((clump) => summary(clump).centre);
  }
  return clumps;
};

/**
 * The hands in some hand pixels: two clumps further apart than `minGap` are two hands, each named by most of its
 * labels and never both the same; closer, they are one hand, named by most of all the labels. A tie names the
 * image's left clump the right hand, as a person facing the camera shows it.
 * @param minGap the least distance between two hands' centres, in pixels
 */
export const handsOf = (pixels: HandPixel[], minGap: number): Pick<KeyPoints, "leftHand" | "rightHand"> => {
  if (pixels.length === 0) return { leftHand: null, rightHand: null };
  const [a, b] = twoClumps(pixels).map((clump) => (clump.length > 0 ? summary(clump) : undefined));
  if (!a || !b || Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y) < minGap) {
    const one = summary(pixels);
    return one.votes > 0 ? { leftHand: one.centre, rightHand: null } : { leftHand: null, rightHand: one.centre };
  }
  // `a` is on the image's left, as it grew from the leftmost pixel
  return a.votes > b.votes ? { leftHand: a.centre, rightHand: b.centre } : { leftHand: b.centre, rightHand: a.centre };
};
