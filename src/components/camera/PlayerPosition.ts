import type { Point, VisionFrame } from "../../vision/VisionTypes";
import { screenFloorForImage, type Corners } from "./FloorGeometry";

/** How far a player's silhouette may go below their ground point, as a fraction of it; ignores stray pixels. */
const GROUND_STRAY_FRACTION = 0.01;

/** How far above the ground point the pixels that place it across are taken from, as a fraction of the frame's height. */
const GROUND_BAND_FRACTION = 0.03;

/**
 * The z-index of depth 0, the back of the floor, in the depth stack. Everything sorted by depth is negative, so
 * whatever in the foreground has no depth stays in front of it, as a challenge's foreground always has.
 */
const DEPTH_Z_INDEX_BASE = -1000;

/** The z-index for a player who isn't sorted, as in a 2D scene: behind everything with a depth. */
export const UNSORTED_PLAYER_Z_INDEX = DEPTH_Z_INDEX_BASE;

/** The class of the element that players and foreground items are sorted within. */
export const DEPTH_STACK_CLASS = "depthStack";

/** How a player's position follows their silhouette. */
export interface PositionSettings {
  /** How long the lowest ground point is kept, in milliseconds, so a jump doesn't look like moving away. */
  windowMs: number;
  /** How far the ground point must move to change the position, in % of the frame, to stop flicker. */
  deadband: number;
}

/**
 * Where a silhouette meets the ground, as percentages of the frame, or null if it is empty: down to its bottom, and
 * across to the middle of its lowest pixels.
 *
 * A camera looking down on the floor sees nearer people lower in the picture, so this stands for where they are.
 * It needs no foot to be recognised, which models often can't do from behind.
 */
export const groundPointOf = (mask: Uint8Array, width: number): Point | null => {
  const height = mask.length / width;
  const rows = new Uint32Array(height);
  const across = new Float64Array(height);
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    const row = Math.floor(i / width);
    rows[row]++;
    across[row] += i % width;
    total++;
  }
  if (total === 0) return null;

  let below = 0;
  for (let row = height - 1; row >= 0; row--) {
    below += rows[row];
    if (below <= total * GROUND_STRAY_FRACTION) continue;
    let [count, sum] = [0, 0];
    for (let band = row; band >= Math.max(0, row - Math.ceil(height * GROUND_BAND_FRACTION)); band--) {
      count += rows[band];
      sum += across[band];
    }
    return { x: (100 * (sum / count + 0.5)) / width, y: (100 * (row + 1)) / height };
  }
  return null;
};

/** Follows one player's ground point, smoothed into a position that jumps and jitter don't change. */
export class PositionFollower {
  private readonly settings: PositionSettings;
  private samples: { timestamp: number; y: number }[] = [];
  private position: Point | undefined;

  constructor(settings: PositionSettings) {
    this.settings = settings;
  }

  /**
   * Takes a new ground point.
   * @param ground the ground point, as percentages of the frame
   * @param timestamp when it was seen, in milliseconds
   * @returns the player's ground point: coming nearer shows at once, and moving away only after the window has passed.
   * Moving across shows while they are on the ground, so a jump holds where they took off from.
   */
  update(ground: Point, timestamp: number): Point {
    const { windowMs, deadband } = this.settings;
    this.samples = this.samples.filter((sample) => timestamp - sample.timestamp < windowMs);
    this.samples.push({ timestamp, y: ground.y });
    const lowest = Math.max(...this.samples.map((sample) => sample.y));
    const last = this.position ?? ground;
    const y = this.position === undefined || Math.abs(lowest - last.y) > deadband ? lowest : last.y;
    const grounded = Math.abs(ground.y - y) <= deadband;
    const x = this.position === undefined || (grounded && Math.abs(ground.x - last.x) > deadband) ? ground.x : last.x;
    this.position = { x, y };
    return this.position;
  }

  /** The ground point last worked out, if any. */
  get current(): Point | undefined {
    return this.position;
  }
}

/** Turns a ground point, in image fractions, into a player's position. */
export type PositionMapping = (image: Point) => Point;

/**
 * How ground points become positions: screen floor coordinates on a floor, or else percentages of the scene, with
 * x from the screen's left either way.
 * @param corners the floor, in a 2.5D scene; none in a 2D one
 * @param mirrored whether the camera image is shown flipped like a mirror
 */
export const positionMapping =
  (corners: Corners | undefined, mirrored: boolean): PositionMapping =>
  (image) =>
    corners
      ? screenFloorForImage(corners, image, mirrored)
      : { x: 100 * (mirrored ? 1 - image.x : image.x), y: 100 * image.y };

/** Where a player is. */
export interface PlayerPosition {
  /** Their smoothed ground point, as percentages of the camera frame. */
  ground: Point;
  /** Their position: see {@link positionMapping}. */
  position: Point;
}

/** Follows where each player in the frames is. */
export class PlayerPositions {
  private readonly settings: PositionSettings;
  private readonly followers = new Map<number, PositionFollower>();

  /** @param settings how each player's position follows them */
  constructor(settings: PositionSettings) {
    this.settings = settings;
  }

  /**
   * Works out where the frame's players are. A held player stays where they were last seen.
   * @param toPosition how ground points become positions, which can change between frames as scenes do
   * @returns each player's position, by id; none for a player whose ground hasn't been seen
   */
  update(frame: VisionFrame, toPosition: PositionMapping): Map<number, PlayerPosition> {
    const seen = new Set(frame.people.map(({ id }) => id));
    for (const id of this.followers.keys()) if (!seen.has(id)) this.followers.delete(id);

    const positions = new Map<number, PlayerPosition>();
    for (const { id, mask, held } of frame.people) {
      let follower = this.followers.get(id);
      if (!follower) {
        follower = new PositionFollower(this.settings);
        this.followers.set(id, follower);
      }
      const seenGround = held ? null : groundPointOf(mask, frame.width);
      const ground = seenGround === null ? follower.current : follower.update(seenGround, frame.timestamp);
      if (ground !== undefined)
        positions.set(id, { ground, position: toPosition({ x: ground.x / 100, y: ground.y / 100 }) });
    }
    return positions;
  }
}

/** The z-index that sorts something at the given floor depth in the depth stack, kept to the floor. */
export const depthZIndex = (depth: number): number =>
  DEPTH_Z_INDEX_BASE + Math.round(Math.min(Math.max(depth, 0), 100));

/** Draws a player's ground point's height as a line across their canvas, for debugging. */
export const drawDepthLine = (ctx: CanvasRenderingContext2D, ground: number): void => {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "lime";
  ctx.fillRect(0, (height * ground) / 100 - 1, width, 3);
};
