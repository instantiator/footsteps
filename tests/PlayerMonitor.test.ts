import { describe, expect, it } from "vitest";
import type { FootPosition, MaskRect } from "../src/components/camera/CameraSupport";
import {
  PlayerMonitor,
  type MonitorTarget,
  type PlayerFrame,
  type PlayerMonitorEvent,
} from "../src/components/camera/PlayerMonitor";
import { noKeyPoints, type KeyPoints } from "../src/vision/VisionTypes";

const WIDTH = 10;
const HEIGHT = 10;

/** A part's key point at the centre, with a radius that reaches every pixel: its pixels are the mask's. */
const WHOLE_FRAME_SCALE = 10;

/** The parts a test can place. */
type Part = "leftHand" | "rightHand" | "leftFoot" | "head";

/** Key points that place the part over the whole frame. */
const placed = (part: Part): Partial<KeyPoints> =>
  part === "head"
    ? { headTop: { x: 0, y: 0 }, headBottom: { x: 9, y: 9 }, headLeft: { x: 0, y: 0 }, headRight: { x: 9, y: 9 } }
    : { [part]: { x: 5, y: 5 } };

/** A frame whose player's silhouette is the given pixels, with the given key points and feet. */
const frame = (
  pixels: [x: number, y: number][],
  keyPoints: Partial<KeyPoints> = {},
  feet: FootPosition | null = null,
  scale = WHOLE_FRAME_SCALE,
): PlayerFrame => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (const [x, y] of pixels) mask[y * WIDTH + x] = 1;
  return { id: 1, mask, keyPoints: { ...noKeyPoints(), ...keyPoints }, scale, width: WIDTH, height: HEIGHT, feet };
};

/** A frame whose silhouette is the given pixels, all of them the given part. */
const partFrame = (part: Part, pixels: [x: number, y: number][], feet: FootPosition | null = null) =>
  frame(pixels, placed(part), feet);

/** A frame whose silhouette is the given pixels, all of them a hand. */
const handFrame = (pixels: [x: number, y: number][]) => partFrame("leftHand", pixels);

/** A feet position at the given height in mask pixels. */
const feetAt = (y: number): FootPosition => ({
  absolute: { x: 5, y },
  percent: { x: 50, y: (100 * y) / HEIGHT },
});

/** The left half of the mask. */
const LEFT_HALF: MaskRect = { left: 0, top: 0, right: 5, bottom: 10 };

/** A target on the left half of the mask, unless the test says otherwise. */
const target = (interactions: string[], threshold = 1, rect: MaskRect = LEFT_HALF): MonitorTarget => ({
  rect,
  interactions,
  threshold,
});

/** A monitor that has seen one empty frame, so it reports what begins from now, and the events it reports. */
const monitorWithEvents = () => {
  const events: PlayerMonitorEvent[] = [];
  const monitor = new PlayerMonitor((event) => events.push(event));
  monitor.update(frame([]), {}, 0);
  return { events, monitor };
};

describe("PlayerMonitor first frame", () => {
  it("ignores what already holds on its first frame, and fires once it begins again", () => {
    const events: PlayerMonitorEvent[] = [];
    const monitor = new PlayerMonitor((event) => events.push(event));
    const targets = { "the-element": target(["hand-enter"], 0) };

    monitor.update(handFrame([[1, 1]]), targets, 0);
    monitor.update(handFrame([[1, 1]]), targets, 100);
    expect(events).toEqual([]);

    monitor.update(handFrame([[8, 8]]), targets, 200);
    monitor.update(handFrame([[1, 1]]), targets, 300);
    expect(events).toEqual([{ key: "the-element", interaction: "hand-enter" }]);
  });
});

describe("PlayerMonitor coverage", () => {
  it.each([
    ["hand-enter", "leftHand"],
    ["hand-enter", "rightHand"],
    ["foot-enter", "leftFoot"],
    ["head-enter", "head"],
  ] as const)("fires a %s interaction when the %s is inside", (interaction, part) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(partFrame(part, [[1, 1]]), { "the-element": target([interaction], 0) }, 0);
    expect(events).toEqual([{ key: "the-element", interaction }]);
  });

  it("counts the whole silhouette for a body interaction, with no key points placed", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(
      frame([
        [1, 1],
        [2, 2],
      ]),
      { "the-element": target(["body-enter"], 1) },
      0,
    );
    expect(events).toEqual([{ key: "the-element", interaction: "body-enter" }]);
  });

  it("applies the threshold to each part separately for an any interaction", () => {
    const { events, monitor } = monitorWithEvents();
    // The hand (a small disc at (4, 1)) is only half inside, and so is the body, but the foot is entirely inside
    const handAndFoot = frame(
      [
        [4, 1],
        [5, 1],
        [2, 8],
      ],
      { leftHand: { x: 4, y: 1 }, leftFoot: { x: 2, y: 8 } },
      null,
      1,
    );
    monitor.update(handAndFoot, { "the-element": target(["any-enter"], 1) }, 0);
    expect(events).toEqual([{ key: "the-element", interaction: "any-enter" }]);
  });
});

describe("PlayerMonitor part groups", () => {
  it("fires a hand interaction at threshold 1 when one hand is wholly inside and the other is outside", () => {
    const { events, monitor } = monitorWithEvents();
    const hands = frame(
      [
        [1, 1],
        [8, 8],
      ],
      { leftHand: { x: 1, y: 1 }, rightHand: { x: 8, y: 8 } },
      null,
      0,
    );
    monitor.update(hands, { "the-element": target(["hand-enter"], 1) }, 0);
    expect(events).toEqual([{ key: "the-element", interaction: "hand-enter" }]);
  });
});

describe("PlayerMonitor thresholds", () => {
  /** Whether a hand pixel inside and another outside fires at the given threshold. */
  const firesAt = (threshold: number, pixels: [number, number][]) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(handFrame(pixels), { "the-element": target(["hand-enter"], threshold) }, 0);
    return events.length === 1;
  };

  it("fires at threshold 0 with a single pixel inside, even with the rest outside", () => {
    expect(
      firesAt(0, [
        [1, 1],
        [8, 8],
        [9, 9],
      ]),
    ).toBe(true);
  });

  it("fires at threshold 0.5 when half of the part is inside", () => {
    expect(
      firesAt(0.5, [
        [1, 1],
        [8, 8],
      ]),
    ).toBe(true);
    expect(
      firesAt(0.5, [
        [1, 1],
        [8, 8],
        [9, 9],
      ]),
    ).toBe(false);
  });

  it("fires at threshold 1 only when the whole part is inside", () => {
    expect(
      firesAt(1, [
        [1, 1],
        [2, 2],
      ]),
    ).toBe(true);
    expect(
      firesAt(1, [
        [1, 1],
        [8, 8],
      ]),
    ).toBe(false);
  });

  it("clamps a threshold above 1 to a whole part", () => {
    expect(
      firesAt(1.01, [
        [1, 1],
        [2, 2],
      ]),
    ).toBe(true);
  });

  it("does not fire when nothing is inside", () => {
    expect(firesAt(0, [[8, 8]])).toBe(false);
  });
});

describe("PlayerMonitor edge triggering", () => {
  const handTarget = { "the-element": target(["hand-enter"], 0) };
  const inside = handFrame([[1, 1]]);
  const outside = handFrame([[8, 8]]);

  it("fires once while the interaction holds", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, handTarget, 0);
    monitor.update(inside, handTarget, 16);
    monitor.update(inside, handTarget, 32);
    expect(events).toHaveLength(1);
  });

  it("fires again after the interaction stops and starts", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, handTarget, 0);
    monitor.update(outside, handTarget, 16);
    monitor.update(inside, handTarget, 32);
    expect(events).toHaveLength(2);
  });

  it("reports two elements independently", () => {
    const { events, monitor } = monitorWithEvents();
    const targets = {
      "left-element": target(["hand-enter"], 0),
      "right-element": target(["hand-enter"], 0, { left: 5, top: 0, right: 10, bottom: 10 }),
    };
    monitor.update(
      handFrame([
        [1, 1],
        [8, 8],
      ]),
      targets,
      0,
    );
    expect(events).toEqual([
      { key: "left-element", interaction: "hand-enter" },
      { key: "right-element", interaction: "hand-enter" },
    ]);
  });

  it("re-arms an element that leaves the targets and comes back", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, handTarget, 0);
    monitor.update(inside, {}, 16);
    monitor.update(inside, handTarget, 32);
    expect(events).toHaveLength(2);
  });

  it("ignores interactions it does not know", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, { "the-element": target(["nope"], 0) }, 0);
    expect(events).toEqual([]);
  });
});

describe("PlayerMonitor jumps", () => {
  /** Elements on the left (A) and right (B) halves of the mask, accepting every jump interaction. */
  const JUMPS = ["jump", "jump-from", "jump-onto"];
  const targets = {
    a: target(JUMPS, 0),
    b: target(JUMPS, 0, { left: 5, top: 0, right: 10, bottom: 10 }),
  };

  /** A frame with the feet at the given height (mask pixels; the player is 5 tall), standing on A or B. */
  const feetFrame = (y: number | null, on: "a" | "b" = "a"): PlayerFrame =>
    partFrame("leftFoot", [on === "a" ? [1, 1] : [8, 8]], y === null ? null : feetAt(y));

  /** Feeds frames 100 ms apart, and returns the events reported. */
  const run = (frames: PlayerFrame[], jumpTargets: Record<string, MonitorTarget> = targets) => {
    const { events, monitor } = monitorWithEvents();
    frames.forEach((frame, index) => monitor.update(frame, jumpTargets, (index + 1) * 100));
    return events;
  };

  /** Standing for long enough to take off. */
  const STAND = [feetFrame(9), feetFrame(9)];

  it("fires jump, jump-from and jump-onto for a jump that takes off from and lands on the same element", () => {
    expect(run([...STAND, feetFrame(8), feetFrame(9)])).toEqual([
      { key: "a", interaction: "jump" },
      { key: "a", interaction: "jump-from" },
      { key: "a", interaction: "jump-onto" },
    ]);
  });

  it("fires jump-from where the feet took off, and jump-onto where they landed, for a jump between elements", () => {
    expect(run([...STAND, feetFrame(8, "b"), feetFrame(9, "b")])).toEqual([
      { key: "a", interaction: "jump-from" },
      { key: "b", interaction: "jump-onto" },
    ]);
  });

  it("fires nothing for standing still, or for walking from one element to another", () => {
    expect(run([...STAND, feetFrame(9), feetFrame(9, "b"), feetFrame(9, "b")])).toEqual([]);
  });

  it("still lands a jump when the feet are lost for a frame in the air", () => {
    expect(run([...STAND, feetFrame(8), feetFrame(null), feetFrame(9, "b")])).toEqual([
      { key: "a", interaction: "jump-from" },
      { key: "b", interaction: "jump-onto" },
    ]);
  });

  it("fires only the jump interactions an element accepts", () => {
    const onlyOnto = { a: target(["jump-onto", "hand-enter"], 0) };
    expect(run([...STAND, feetFrame(8), feetFrame(9)], onlyOnto)).toEqual([{ key: "a", interaction: "jump-onto" }]);
  });

  it("fires again for a second jump", () => {
    expect(run([...STAND, feetFrame(8), feetFrame(9), feetFrame(9), feetFrame(8), feetFrame(9)])).toHaveLength(6);
  });

  it("measures a jump against the player's height, from their feet to the top of their head", () => {
    // A rise of 0.3px is 6% of a 5px player, more than the 4% needed, but only 3% of a 10px one
    const tall = (y: number) => frame([[1, 1]], { ...placed("leftFoot"), headTop: { x: 5, y: y - 10 } }, feetAt(y));
    expect(run([tall(9), tall(9), tall(8.7), tall(9)])).toEqual([]);
    expect(run([...STAND, feetFrame(8.7), feetFrame(9)])).toHaveLength(3);
  });
});

describe("PlayerMonitor exits", () => {
  const INOUT = { "the-element": target(["hand-enter", "hand-exit"], 0) };
  const inside = handFrame([[1, 1]]);
  const outside = handFrame([[8, 8]]);
  const ENTERED = { key: "the-element", interaction: "hand-enter" };
  const EXITED = { key: "the-element", interaction: "hand-exit" };

  /** A monitor needing the given frames, armed by an empty frame, fed the given frames 16 ms apart. */
  const run = (frames: PlayerFrame[], stableFrames = 1, targets: Record<string, MonitorTarget> = INOUT) => {
    const events: PlayerMonitorEvent[] = [];
    const monitor = new PlayerMonitor((event) => events.push(event), stableFrames);
    monitor.update(frame([]), {}, 0);
    frames.forEach((f, i) => monitor.update(f, targets, (i + 1) * 16));
    return { events, monitor };
  };

  it("fires an exit when a part that entered leaves", () => {
    expect(run([inside, inside, outside]).events).toEqual([ENTERED, EXITED]);
  });

  it("fires an exit for an element that only accepts exits, once a part has entered it", () => {
    expect(run([outside, inside, outside], 1, { "the-element": target(["hand-exit"], 0) }).events).toEqual([EXITED]);
  });

  it("fires no exit for a part that never entered, including one already over the element when it started", () => {
    const events: PlayerMonitorEvent[] = [];
    const monitor = new PlayerMonitor((event) => events.push(event));
    [inside, inside, outside].forEach((f, i) => monitor.update(f, INOUT, i * 16));
    expect(events).toEqual([]);
  });

  it("ignores a part away for fewer frames than it needs, and exits once it has been away long enough", () => {
    expect(run([inside, inside, outside, inside, inside], 2).events).toEqual([ENTERED]);
    expect(run([inside, inside, outside, outside], 2).events).toEqual([ENTERED, EXITED]);
  });

  it("fires the exits of everything entered when the player is released, as they have gone", () => {
    const { events, monitor } = run([inside]);
    monitor.release();
    expect(events).toEqual([ENTERED, EXITED]);
    monitor.release();
    expect(events).toHaveLength(2);
  });
});

describe("PlayerMonitor holds", () => {
  const holdTarget = { "the-element": { ...target(["hand-enter"], 0), holdMs: 500 } };
  const inside = handFrame([[1, 1]]);
  const outside = handFrame([[8, 8]]);

  it("fires once the part has stayed over the element for the target's hold, and not before", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, holdTarget, 100);
    monitor.update(inside, holdTarget, 599);
    expect(events).toEqual([]);
    monitor.update(inside, holdTarget, 600);
    monitor.update(inside, holdTarget, 900);
    expect(events).toEqual([{ key: "the-element", interaction: "hand-enter" }]);
  });

  it("starts the hold again when the part leaves before it is over", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(inside, holdTarget, 100);
    monitor.update(outside, holdTarget, 400);
    monitor.update(inside, holdTarget, 500);
    monitor.update(inside, holdTarget, 900);
    expect(events).toEqual([]);
    monitor.update(inside, holdTarget, 1000);
    expect(events).toHaveLength(1);
  });
});

describe("PlayerMonitor stable frames", () => {
  const handTarget = { "the-element": target(["hand-enter"], 0) };
  const inside = handFrame([[1, 1]]);
  const outside = handFrame([[8, 8]]);

  /** A monitor needing three frames, armed by an empty frame, and the events it reports. */
  const stableMonitor = () => {
    const events: PlayerMonitorEvent[] = [];
    const monitor = new PlayerMonitor((event) => events.push(event), 3);
    monitor.update(frame([]), {}, 0);
    return { events, monitor };
  };

  it("ignores an interaction that flickers for fewer frames than it needs", () => {
    const { events, monitor } = stableMonitor();
    [inside, inside, outside, inside, outside].forEach((f, i) => monitor.update(f, handTarget, i * 16));
    expect(events).toEqual([]);
  });

  it("fires once, on the frame the interaction has held long enough", () => {
    const { events, monitor } = stableMonitor();
    monitor.update(inside, handTarget, 0);
    monitor.update(inside, handTarget, 16);
    expect(events).toEqual([]);
    monitor.update(inside, handTarget, 32);
    monitor.update(inside, handTarget, 48);
    expect(events).toEqual([{ key: "the-element", interaction: "hand-enter" }]);
  });

  it("never fires for an interaction already holding when it started, until it lets go", () => {
    const events: PlayerMonitorEvent[] = [];
    const monitor = new PlayerMonitor((event) => events.push(event), 2);
    [inside, inside, inside].forEach((f, i) => monitor.update(f, handTarget, i * 16));
    expect(events).toEqual([]);
    [outside, inside, inside].forEach((f, i) => monitor.update(f, handTarget, 100 + i * 16));
    expect(events).toHaveLength(1);
  });
});

describe("PlayerMonitor covering", () => {
  /** A target that is on top only where `onTop` says, recording the points it was asked about. */
  const coverable = (interactions: string[], onTop: (point: { x: number; y: number }) => boolean) => {
    const asked: { x: number; y: number }[] = [];
    const isTopmostAt = (point: { x: number; y: number }) => {
      asked.push(point);
      return onTop(point);
    };
    return { asked, target: { ...target(interactions, 0), isTopmostAt } };
  };

  it("doesn't fire where something covers the element", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(handFrame([[1, 1]]), { "the-element": coverable(["hand-enter"], () => false).target }, 100);
    expect(events).toEqual([]);
  });

  it("fires where the element is on top, asking about a point inside both the hand and the element", () => {
    const { events, monitor } = monitorWithEvents();
    const { asked, target: onTop } = coverable(["hand-enter"], () => true);
    monitor.update(handFrame([[1, 1]]), { "the-element": onTop }, 100);
    expect(events).toEqual([{ key: "the-element", interaction: "hand-enter" }]);
    expect(asked.length).toBeGreaterThan(0);
    for (const { x, y } of asked) {
      expect(x).toBeGreaterThanOrEqual(LEFT_HALF.left);
      expect(x).toBeLessThanOrEqual(LEFT_HALF.right);
      expect(y).toBeGreaterThanOrEqual(LEFT_HALF.top);
      expect(y).toBeLessThanOrEqual(LEFT_HALF.bottom);
    }
  });

  it("asks about each part at most once a frame, however many interactions share it", () => {
    const { monitor } = monitorWithEvents();
    // Nothing is on top, so every interaction checks every part it has; the hand and body have different centres
    const { asked, target: covered } = coverable(["hand-enter", "any-enter", "body-enter"], () => false);
    monitor.update(frame([[1, 1]], { leftHand: { x: 1, y: 1 } }, null, 0), { "the-element": covered }, 100);
    expect(asked).toEqual([
      { x: 1.5, y: 1.5 },
      { x: 2.5, y: 5 },
    ]);
  });

  it("doesn't count a jump onto a covered element", () => {
    const { events, monitor } = monitorWithEvents();
    const covered = { "the-element": coverable(["jump"], () => false).target };
    [9, 9, 8, 9].forEach((y, index) =>
      monitor.update(partFrame("leftFoot", [[1, 1]], feetAt(y)), covered, (index + 1) * 100),
    );
    expect(events).toEqual([]);
  });
});
