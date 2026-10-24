import { BODY_PARTS, BodyPart } from "./BodyPart";
import type { PixelRect, Point, VisionFrame, VisionPerson } from "./VisionTypes";

/** A body part found at a point. */
export interface BodyPartAtPoint {
  /** The {@link VisionPerson.id} of the person the part belongs to. */
  personId: number;
  /** Which part was found. */
  part: BodyPart;
}

/** A body part found in an area, and how much of it is inside. */
export interface BodyPartInArea extends BodyPartAtPoint {
  /** The fraction (0–1) of the part's pixels that are inside the area. */
  proportion: number;
}

/** The pixels a body part may cover: the bounds to search, and whether a pixel within them counts. */
interface PartRegion {
  bounds: PixelRect;
  contains: (x: number, y: number) => boolean;
}

/** A line between two points of a skeleton, eg. elbow to wrist. */
export type Segment = [Point, Point];

/** Clips a rectangle to the frame, rounding to whole pixels. */
const clip = (rect: PixelRect, width: number, height: number): PixelRect => ({
  left: Math.max(0, Math.floor(rect.left)),
  top: Math.max(0, Math.floor(rect.top)),
  right: Math.min(width, Math.ceil(rect.right)),
  bottom: Math.min(height, Math.ceil(rect.bottom)),
});

/** Always true: every pixel in the bounds counts. */
const everyPixel = () => true;

/**
 * Where a body part is: the whole frame for the body, the box the head's extremes span, and a disc of the
 * person's `scale` around each hand and foot. Only the person's own mask pixels within it are the part.
 * @returns the region, or null if the model did not place the part
 */
export const partRegion = (person: VisionPerson, part: BodyPart, width: number, height: number): PartRegion | null => {
  if (part === BodyPart.BODY)
    return { bounds: { left: 0, top: 0, right: width, bottom: height }, contains: everyPixel };

  const { keyPoints } = person;
  if (part === BodyPart.HEAD) {
    const points = [keyPoints.headTop, keyPoints.headBottom, keyPoints.headLeft, keyPoints.headRight].filter(
      (point): point is Point => point !== null,
    );
    if (points.length < 4) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const box = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs) + 1,
      bottom: Math.max(...ys) + 1,
    };
    return { bounds: clip(box, width, height), contains: everyPixel };
  }

  const centre = keyPoints[part];
  if (!centre) return null;
  const r = person.scale;
  const box = { left: centre.x - r, top: centre.y - r, right: centre.x + r + 1, bottom: centre.y + r + 1 };
  return {
    bounds: clip(box, width, height),
    contains: (x, y) => (x - centre.x) ** 2 + (y - centre.y) ** 2 <= r * r,
  };
};

/** Counts the person's mask pixels in the region that are also inside the area. */
const countInRegion = (person: VisionPerson, region: PartRegion, area: PixelRect, width: number): number => {
  const left = Math.max(region.bounds.left, area.left);
  const top = Math.max(region.bounds.top, area.top);
  const right = Math.min(region.bounds.right, area.right);
  const bottom = Math.min(region.bounds.bottom, area.bottom);
  let count = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (person.mask[y * width + x] === 1 && region.contains(x, y)) count++;
    }
  }
  return count;
};

/** Each person's pixel count per part, as many areas are tested against the same frame. */
const partTotals = new WeakMap<VisionPerson, Map<BodyPart, number>>();

/** The person's pixel count for a part, cached per person per frame. */
const partTotal = (person: VisionPerson, part: BodyPart, region: PartRegion, width: number): number => {
  let totals = partTotals.get(person);
  if (!totals) partTotals.set(person, (totals = new Map()));
  let total = totals.get(part);
  if (total === undefined) totals.set(part, (total = countInRegion(person, region, region.bounds, width)));
  return total;
};

/** Whether a pixel is in a region; never for a part that was not placed. */
const regionHas = (region: PartRegion | null, x: number, y: number): boolean => {
  if (!region) return false;
  const { left, top, right, bottom } = region.bounds;
  return x >= left && x < right && y >= top && y < bottom && region.contains(x, y);
};

/** The body parts, of anyone, at a point in mask pixels. */
export const bodyPartsAt = (frame: VisionFrame, point: Point): BodyPartAtPoint[] => {
  const { width, height } = frame;
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= width || y >= height) return [];

  const found: BodyPartAtPoint[] = [];
  for (const person of frame.people) {
    if (person.mask[y * width + x] !== 1) continue;
    for (const part of BODY_PARTS) {
      if (regionHas(partRegion(person, part, width, height), x, y)) found.push({ personId: person.id, part });
    }
  }
  return found;
};

/** The body parts, of anyone, with any pixels inside an area in mask pixels, and how much of each is inside. */
export const bodyPartsIn = (frame: VisionFrame, area: PixelRect): BodyPartInArea[] => {
  const { width, height } = frame;
  const found: BodyPartInArea[] = [];
  for (const person of frame.people) {
    for (const part of BODY_PARTS) {
      const region = partRegion(person, part, width, height);
      if (!region) continue;
      const inside = countInRegion(person, region, area, width);
      if (inside > 0)
        found.push({ personId: person.id, part, proportion: inside / partTotal(person, part, region, width) });
    }
  }
  return found;
};

/** The squared distance from a pixel to a segment. */
const distanceSquared = (x: number, y: number, [a, b]: Segment): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
  return (a.x + t * dx - x) ** 2 + (a.y + t * dy - y) ** 2;
};

/** The index of the skeleton nearest a pixel, among the candidates. */
const nearestSkeleton = (x: number, y: number, skeletons: Segment[][], candidates: number[]): number => {
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const index of candidates) {
    for (const segment of skeletons[index]) {
      const distance = distanceSquared(x, y, segment);
      if (distance < bestDistance) [best, bestDistance] = [index, distance];
    }
  }
  return best;
};

/** How far beyond its key points a skeleton's silhouette may reach, as a fraction of its larger side. */
const SKELETON_MARGIN = 0.25;

/** The skeleton's bounding box, grown by {@link SKELETON_MARGIN}. */
const reach = (skeleton: Segment[]): PixelRect => {
  const points = skeleton.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const box = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  const margin = SKELETON_MARGIN * Math.max(box.right - box.left, box.bottom - box.top);
  return { left: box.left - margin, top: box.top - margin, right: box.right + margin, bottom: box.bottom + margin };
};

/**
 * Splits one silhouette of everyone into a mask per person, giving each pixel to the nearest skeleton.
 *
 * Only pixels within reach of more than one skeleton (or none) are measured; the rest go to the only one in reach.
 * @param mask one byte per pixel, 1 where anyone is
 * @param skeletons each person's limbs, in the order the masks are returned
 */
export const splitMaskByNearestSkeleton = (mask: Uint8Array, width: number, skeletons: Segment[][]): Uint8Array[] => {
  const masks = skeletons.map(() => new Uint8Array(mask.length));
  if (skeletons.length === 1) masks[0].set(mask);
  if (skeletons.length <= 1) return masks;

  const reaches = skeletons.map(reach);
  const all = skeletons.map((_, index) => index);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    const x = i % width;
    const y = (i - x) / width;
    const inReach = all.filter((index) => {
      const r = reaches[index];
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    const owner = inReach.length === 1 ? inReach[0] : nearestSkeleton(x, y, skeletons, inReach.length ? inReach : all);
    masks[owner][i] = 1;
  }
  return masks;
};
