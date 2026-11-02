import type { VisionFrame } from "../../vision/VisionTypes";

/** How far a player's silhouette may go below their ground point, as a fraction of it; ignores stray pixels. */
const GROUND_STRAY_FRACTION = 0.01;

/**
 * The z-index of depth 0, the top of the scene, in the depth stack. Everything sorted by depth is negative, so
 * whatever in the foreground has no depth stays in front of it, as a challenge's foreground always has.
 */
const DEPTH_Z_INDEX_BASE = -1000;

/** The z-index for a player whose depth isn't being followed: behind everything with a depth. */
export const UNSORTED_PLAYER_Z_INDEX = DEPTH_Z_INDEX_BASE;

/** The class of the element that players and foreground items are sorted within. */
export const DEPTH_STACK_CLASS = "depthStack";

/** How a player's depth follows their silhouette. */
export interface DepthSettings {
  /** How long the lowest ground point is kept, in milliseconds, so a jump doesn't look like moving away. */
  windowMs: number;
  /** How far the ground point must move to change the depth, in % of the scene's height, to stop flicker. */
  deadband: number;
}

/**
 * The bottom of a silhouette, as a percentage of the frame's height, or null if it is empty.
 *
 * A camera looking down on the floor sees nearer people lower in the picture, so this stands for how near they are.
 * It needs no foot to be recognised, which models often can't do from behind.
 */
export const groundOf = (mask: Uint8Array, width: number): number | null => {
  const height = mask.length / width;
  const rows = new Uint32Array(height);
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    rows[Math.floor(i / width)]++;
    total++;
  }
  if (total === 0) return null;

  let below = 0;
  for (let row = height - 1; row >= 0; row--) {
    below += rows[row];
    if (below > total * GROUND_STRAY_FRACTION) return (100 * (row + 1)) / height;
  }
  return null;
};

/** Follows one player's ground point, smoothed into a depth that jumps and jitter don't change. */
export class DepthFollower {
  private readonly settings: DepthSettings;
  private samples: { timestamp: number; ground: number }[] = [];
  private depth: number | undefined;

  constructor(settings: DepthSettings) {
    this.settings = settings;
  }

  /**
   * Takes a new ground point.
   * @param ground the ground point, as a percentage of the frame's height
   * @param timestamp when it was seen, in milliseconds
   * @returns the player's depth: coming nearer shows at once, moving away only after the window has passed
   */
  update(ground: number, timestamp: number): number {
    this.samples = this.samples.filter((sample) => timestamp - sample.timestamp < this.settings.windowMs);
    this.samples.push({ timestamp, ground });
    const lowest = Math.max(...this.samples.map((sample) => sample.ground));
    if (this.depth === undefined || Math.abs(lowest - this.depth) > this.settings.deadband) this.depth = lowest;
    return this.depth;
  }

  /** The depth last worked out, if any. */
  get current(): number | undefined {
    return this.depth;
  }
}

/** An item's depth from its `data-depth` attribute, which comes from game content: a number, kept to 0–100, or null. */
export const parseDepth = (value: string | null): number | null => {
  const depth = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(depth) ? Math.min(Math.max(depth, 0), 100) : null;
};

/** The z-index that sorts something at the given depth in the depth stack. */
export const depthZIndex = (depth: number): number => DEPTH_Z_INDEX_BASE + Math.round(depth);

/** Draws a player's depth as a line across their canvas, for debugging. */
export const drawDepthLine = (ctx: CanvasRenderingContext2D, depth: number): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "lime";
  ctx.fillRect(0, (height * depth) / 100 - 1, width, 3);
};

/** Sorts the players in a frame among the foreground items that have a `data-depth`, in their depth stack. */
export class PlayerDepths {
  private readonly stack: Element | null;
  private readonly settings: DepthSettings;
  private readonly followers = new Map<number, DepthFollower>();

  /**
   * @param canvas a player's canvas, inside the depth stack; with no stack, nothing is sorted
   * @param settings how each player's depth follows them
   */
  constructor(canvas: Element, settings: DepthSettings) {
    this.stack = canvas.closest(`.${DEPTH_STACK_CLASS}`);
    this.settings = settings;
  }

  /**
   * Sorts the items, and works out where the frame's players go among them. Items may come and go between frames, and
   * a template re-render can drop their z-index, so this runs every frame.
   * @param always whether to work out depths even with no items to sort them among, eg. to show them when debugging
   * @returns each player's depth, by id; none when there's nothing to sort them among
   */
  update(frame: VisionFrame, always: boolean): Map<number, number> {
    const depths = new Map<number, number>();
    if (this.sortItems() === 0 && !always) return depths;

    const seen = new Set(frame.people.map(({ id }) => id));
    for (const id of this.followers.keys()) if (!seen.has(id)) this.followers.delete(id);

    for (const { id, mask, held } of frame.people) {
      let follower = this.followers.get(id);
      if (!follower) {
        follower = new DepthFollower(this.settings);
        this.followers.set(id, follower);
      }
      // A held player stays where they were last seen
      const ground = held ? null : groundOf(mask, frame.width);
      const depth = ground === null ? follower.current : follower.update(ground, frame.timestamp);
      if (depth !== undefined) depths.set(id, depth);
    }
    return depths;
  }

  /** Takes the items out of the sort, for when no players are being followed. */
  clearItems(): void {
    for (const item of this.items()) item.style.removeProperty("z-index");
  }

  /** The foreground items with a `data-depth`. */
  private items(): HTMLElement[] {
    return this.stack ? Array.from(this.stack.querySelectorAll<HTMLElement>("[data-depth]")) : [];
  }

  /**
   * Gives each item with a valid depth its z-index.
   * @returns how many there are
   */
  private sortItems(): number {
    let count = 0;
    for (const item of this.items()) {
      const depth = parseDepth(item.getAttribute("data-depth"));
      if (depth === null) continue;
      item.style.zIndex = String(depthZIndex(depth));
      count++;
    }
    return count;
  }
}
