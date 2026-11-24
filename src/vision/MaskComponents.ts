/** Which separate patches of a person's pixels to keep as part of them. */
export interface StraySettings {
  /** The smallest patch kept beside the main body, as a share of the main body's pixels (0–1). */
  minShare: number;
  /** The furthest a kept patch may be from the main body, as a share of the frame's width (0–1). */
  maxGap: number;
}

/** A person's pixels once their strays are removed. */
export interface MainBody {
  /** Each pixel's part id, with the strays made background. */
  parts: Int32Array;
  /** 1 where a stray was removed, or null if there were none. */
  strays: Uint8Array | null;
}

/** A connected patch of pixels: how many, and the box around them. */
interface Patch {
  size: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** The root of a pixel's patch, halving the path to it on the way. */
const rootOf = (parent: Int32Array, i: number): number => {
  let at = i;
  while (parent[at] !== at) {
    parent[at] = parent[parent[at]];
    at = parent[at];
  }
  return at;
};

/** Joins two pixels' patches. */
const join = (parent: Int32Array, a: number, b: number): void => {
  const [rootA, rootB] = [rootOf(parent, a), rootOf(parent, b)];
  if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
};

/** Each pixel's patch root, -1 for background: pixels touching up, down, left or right share a patch. */
const patchRoots = (parts: ArrayLike<number>, width: number): Int32Array => {
  const parent = new Int32Array(parts.length).fill(-1);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] < 0) continue;
    parent[i] = i;
    if (i % width > 0 && parts[i - 1] >= 0) join(parent, i, i - 1);
    if (i >= width && parts[i - width] >= 0) join(parent, i, i - width);
  }
  for (let i = 0; i < parent.length; i++) if (parent[i] >= 0) parent[i] = rootOf(parent, i);
  return parent;
};

/** The size and box of each patch, by root. */
const patchesOf = (roots: Int32Array, width: number): Map<number, Patch> => {
  const patches = new Map<number, Patch>();
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (root < 0) continue;
    const [x, y] = [i % width, Math.floor(i / width)];
    const patch = patches.get(root);
    if (!patch) patches.set(root, { size: 1, minX: x, maxX: x, minY: y, maxY: y });
    else {
      patch.size++;
      patch.minX = Math.min(patch.minX, x);
      patch.maxX = Math.max(patch.maxX, x);
      patch.minY = Math.min(patch.minY, y);
      patch.maxY = Math.max(patch.maxY, y);
    }
  }
  return patches;
};

/**
 * How far apart two patches are, between their boxes.
 * ponytail: boxes, not pixels, so a curved limb's box can look nearer than its pixels are; measure pixel to pixel if
 * that keeps strays it shouldn't.
 */
const gapBetween = (a: Patch, b: Patch): number =>
  Math.hypot(Math.max(0, a.minX - b.maxX, b.minX - a.maxX), Math.max(0, a.minY - b.maxY, b.minY - a.maxY));

/**
 * Removes the stray patches a segmentation gave a person: pixels far from their body, or too few to be part of it,
 * which would otherwise move where they seem to stand. Keeps the largest patch, and any other big enough and near
 * enough to it, such as a hand the model separated from the arm.
 * @param parts each pixel's part id, row by row, below 0 for background
 * @returns the parts with strays made background, and where the strays were (null if none)
 */
export const keepMainBody = (parts: Int32Array, width: number, { minShare, maxGap }: StraySettings): MainBody => {
  const roots = patchRoots(parts, width);
  const patches = patchesOf(roots, width);
  if (patches.size < 2) return { parts, strays: null };
  const main = Array.from(patches.values()).reduce((a, b) => (b.size > a.size ? b : a));
  const kept = (patch: Patch) =>
    patch === main || (patch.size >= minShare * main.size && gapBetween(patch, main) <= maxGap * width);
  const dropped = new Set(Array.from(patches).flatMap(([root, patch]) => (kept(patch) ? [] : [root])));
  if (dropped.size === 0) return { parts, strays: null };
  const cleaned = Int32Array.from(parts);
  const strays = new Uint8Array(parts.length);
  for (let i = 0; i < roots.length; i++) {
    if (!dropped.has(roots[i])) continue;
    cleaned[i] = -1;
    strays[i] = 1;
  }
  return { parts: cleaned, strays };
};
