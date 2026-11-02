import { describe, expect, it } from "vitest";
import {
  DepthFollower,
  depthZIndex,
  groundOf,
  parseDepth,
  PlayerDepths,
  UNSORTED_PLAYER_Z_INDEX,
} from "../src/components/camera/PlayerDepth";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 100;
const HEIGHT = 100;

/** A silhouette filling the rows from `top` up to but not including `bottom`, across the given columns. */
const silhouette = (top: number, bottom: number, left = 40, right = 60): Uint8Array => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = top; y < bottom; y++) mask.fill(1, y * WIDTH + left, y * WIDTH + right);
  return mask;
};

describe("groundOf", () => {
  it("is the bottom of the silhouette, as a percentage of the frame", () => {
    expect(groundOf(silhouette(20, 75), WIDTH)).toBe(75);
  });

  it("ignores a few stray pixels below the silhouette", () => {
    const mask = silhouette(20, 75);
    mask[99 * WIDTH + 3] = 1;
    expect(groundOf(mask, WIDTH)).toBe(75);
  });

  it("is nothing for an empty silhouette", () => {
    expect(groundOf(new Uint8Array(WIDTH * HEIGHT), WIDTH)).toBeNull();
  });
});

describe("DepthFollower", () => {
  const settings = { windowMs: 700, deadband: 2 };

  it("starts at the first ground point", () => {
    expect(new DepthFollower(settings).update(60, 0)).toBe(60);
  });

  it("keeps the depth through a jump, as the feet rising is not moving away", () => {
    const follower = new DepthFollower(settings);
    follower.update(80, 0);
    for (const [ground, time] of [
      [70, 100],
      [65, 200],
      [70, 300],
      [80, 400],
    ]) {
      expect(follower.update(ground, time)).toBe(80);
    }
  });

  it("shows stepping nearer at once", () => {
    const follower = new DepthFollower(settings);
    follower.update(60, 0);
    expect(follower.update(75, 100)).toBe(75);
  });

  it("shows stepping away only once the window has passed", () => {
    const follower = new DepthFollower(settings);
    follower.update(75, 0);
    expect(follower.update(60, 600)).toBe(75);
    expect(follower.update(60, 800)).toBe(60);
  });

  it("doesn't flicker when the ground point jitters within the deadband", () => {
    const follower = new DepthFollower({ windowMs: 0, deadband: 2 });
    follower.update(60, 0);
    for (const [ground, time] of [
      [61, 100],
      [59, 200],
      [62, 300],
      [58, 400],
    ]) {
      expect(follower.update(ground, time)).toBe(60);
    }
    expect(follower.update(63, 500)).toBe(63);
  });
});

describe("parseDepth", () => {
  it.each([
    ["62", 62],
    ["0", 0],
    ["12.5", 12.5],
    [" 40 ", 40],
  ])("reads %s", (value, depth) => {
    expect(parseDepth(value)).toBe(depth);
  });

  it.each([
    ["150", 100],
    ["-5", 0],
  ])("keeps %s within 0–100", (value, depth) => {
    expect(parseDepth(value)).toBe(depth);
  });

  it.each([null, "", "  ", "near", "Infinity", "1; z-index: 9"])("ignores %s", (value) => {
    expect(parseDepth(value)).toBeNull();
  });
});

describe("PlayerDepths", () => {
  const settings = { windowMs: 0, deadband: 0 };
  const person = (id: number, bottom: number, held?: VisionPerson["held"]): VisionPerson => ({
    id,
    mask: silhouette(10, bottom),
    keyPoints: noKeyPoints(),
    scale: 1,
    ...(held && { held }),
  });
  const frame = (timestamp: number, ...people: VisionPerson[]): VisionFrame => ({
    width: WIDTH,
    height: HEIGHT,
    timestamp,
    people,
  });

  /** A depth stack holding a canvas and items with the given `data-depth` values. */
  const stackWith = (...depths: (string | null)[]) => {
    const stack = document.createElement("div");
    stack.className = "depthStack";
    const canvas = stack.appendChild(document.createElement("canvas"));
    const items = depths.map((depth) => {
      const item = stack.appendChild(document.createElement("div"));
      if (depth !== null) item.setAttribute("data-depth", depth);
      return item;
    });
    return { canvas, items };
  };

  it("sorts a player between a far and a near item", () => {
    const { canvas, items } = stackWith("30", "80");
    const depths = new PlayerDepths(canvas, settings).update(frame(0, person(0, 50)), false);

    const player = depthZIndex(depths.get(0)!);
    expect(Number(items[0].style.zIndex)).toBeLessThan(player);
    expect(Number(items[1].style.zIndex)).toBeGreaterThan(player);
  });

  it("leaves an item with no depth, or a bad one, out of the sort", () => {
    const { canvas, items } = stackWith(null, "soon");
    new PlayerDepths(canvas, settings).update(frame(0, person(0, 50)), false);

    expect(items[0].style.zIndex).toBe("");
    expect(items[1].style.zIndex).toBe("");
  });

  it("works nothing out with no items to sort among, unless asked to", () => {
    const { canvas } = stackWith();
    const depths = new PlayerDepths(canvas, settings);

    expect(depths.update(frame(0, person(0, 50)), false).size).toBe(0);
    expect(depths.update(frame(0, person(0, 50)), true).get(0)).toBe(50);
  });

  it("keeps a held player's depth where they were last seen", () => {
    const { canvas } = stackWith("30");
    const depths = new PlayerDepths(canvas, settings);
    depths.update(frame(0, person(0, 50)), false);

    expect(depths.update(frame(100, person(0, 90, { opacity: 1 })), false).get(0)).toBe(50);
  });

  it("follows each player separately, and forgets one who has gone", () => {
    const { canvas } = stackWith("30");
    const depths = new PlayerDepths(canvas, { windowMs: 700, deadband: 0 });

    const both = depths.update(frame(0, person(0, 50), person(1, 70)), false);
    expect([both.get(0), both.get(1)]).toEqual([50, 70]);

    depths.update(frame(100, person(0, 50)), false);
    expect(depths.update(frame(200, person(0, 50), person(1, 40)), false).get(1)).toBe(40);
  });

  it("takes the items out of the sort when asked", () => {
    const { canvas, items } = stackWith("30");
    const depths = new PlayerDepths(canvas, settings);
    depths.update(frame(0, person(0, 50)), false);

    depths.clearItems();

    expect(items[0].style.zIndex).toBe("");
  });

  it("does nothing outside a depth stack", () => {
    const depths = new PlayerDepths(document.createElement("canvas"), settings);
    expect(depths.update(frame(0, person(0, 50)), false).size).toBe(0);
  });

  it("sorts everything behind whatever in the foreground has no depth", () => {
    expect(depthZIndex(100)).toBeLessThan(0);
    expect(UNSORTED_PLAYER_Z_INDEX).toBeLessThanOrEqual(depthZIndex(0));
  });
});
