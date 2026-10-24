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

/** A feet position at the given height (% of the frame). */
const feetAt = (percentY: number): FootPosition => ({
  absolute: { x: 0, y: 0 },
  percent: { x: 50, y: percentY },
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
    const targets = { "the-element": target(["hand"], 0) };

    monitor.update(handFrame([[1, 1]]), targets, 0);
    monitor.update(handFrame([[1, 1]]), targets, 100);
    expect(events).toEqual([]);

    monitor.update(handFrame([[8, 8]]), targets, 200);
    monitor.update(handFrame([[1, 1]]), targets, 300);
    expect(events).toEqual([{ elementId: "the-element", interaction: "hand" }]);
  });
});

describe("PlayerMonitor coverage", () => {
  it.each([
    ["hand", "leftHand"],
    ["hand", "rightHand"],
    ["foot", "leftFoot"],
    ["head", "head"],
  ] as const)("fires a %s interaction when the %s is inside", (interaction, part) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(partFrame(part, [[1, 1]]), { "the-element": target([interaction], 0) }, 0);
    expect(events).toEqual([{ elementId: "the-element", interaction }]);
  });

  it("counts the whole silhouette for a body interaction, with no key points placed", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(
      frame([
        [1, 1],
        [2, 2],
      ]),
      { "the-element": target(["body"], 1) },
      0,
    );
    expect(events).toEqual([{ elementId: "the-element", interaction: "body" }]);
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
    monitor.update(handAndFoot, { "the-element": target(["any"], 1) }, 0);
    expect(events).toEqual([{ elementId: "the-element", interaction: "any" }]);
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
    monitor.update(hands, { "the-element": target(["hand"], 1) }, 0);
    expect(events).toEqual([{ elementId: "the-element", interaction: "hand" }]);
  });
});

describe("PlayerMonitor thresholds", () => {
  /** Whether a hand pixel inside and another outside fires at the given threshold. */
  const firesAt = (threshold: number, pixels: [number, number][]) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(handFrame(pixels), { "the-element": target(["hand"], threshold) }, 0);
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
  const handTarget = { "the-element": target(["hand"], 0) };
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
      "left-element": target(["hand"], 0),
      "right-element": target(["hand"], 0, { left: 5, top: 0, right: 10, bottom: 10 }),
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
      { elementId: "left-element", interaction: "hand" },
      { elementId: "right-element", interaction: "hand" },
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
  /** The left half of the mask, which the feet are inside of or outside of. */
  const jumpTargets = { "the-element": target(["jump"], 0) };

  /** A jump frame: the feet are at the given height, inside the element unless `inside` is false. */
  const jumpFrame = (percentY: number, inside = true): PlayerFrame =>
    partFrame("leftFoot", [inside ? [1, 1] : [8, 8]], feetAt(percentY));

  /** Feeds a sequence of (height, inside) samples, 100 ms apart, and returns the reported events. */
  const run = (samples: [percentY: number, inside?: boolean][]) => {
    const { events, monitor } = monitorWithEvents();
    samples.forEach(([percentY, inside], index) =>
      monitor.update(jumpFrame(percentY, inside), jumpTargets, index * 100),
    );
    return events;
  };

  const JUMPED = [{ elementId: "the-element", interaction: "jump" }];

  it("fires once for a rise, fall and rest inside the element", () => {
    expect(run([[50], [40], [30], [40], [40]])).toEqual(JUMPED);
  });

  it("does not treat stillness at rest as a jump", () => {
    expect(run([[50], [50], [50]])).toEqual([]);
  });

  it("ignores downward motion before the player has risen", () => {
    expect(run([[40], [50], [50]])).toEqual([]);
  });

  it("does not complete while the player is still moving", () => {
    expect(run([[50], [40], [50], [60], [70]])).toEqual([]);
  });

  it("keeps the sequence while the player briefly leaves the element", () => {
    expect(run([[50], [40], [50, false], [60], [60]])).toEqual(JUMPED);
  });

  it("abandons a sequence that leaves the element for longer than the window", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(jumpFrame(50), jumpTargets, 0);
    monitor.update(jumpFrame(40), jumpTargets, 100);
    monitor.update(jumpFrame(60, false), jumpTargets, 1700);
    monitor.update(jumpFrame(60), jumpTargets, 1800);
    expect(events).toEqual([]);
  });

  it("abandons a sequence that never comes to rest", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(jumpFrame(50), jumpTargets, 0);
    monitor.update(jumpFrame(40), jumpTargets, 100);
    monitor.update(jumpFrame(50), jumpTargets, 200);
    monitor.update(jumpFrame(80), jumpTargets, 1700);
    expect(events).toEqual([]);
  });

  it("treats motion under the speed threshold as still", () => {
    expect(run([[50], [40], [50], [50.2]])).toEqual(JUMPED);
  });

  it("does not advance the sequence without a feet position", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(jumpFrame(50), jumpTargets, 0);
    monitor.update(jumpFrame(40), jumpTargets, 100);
    monitor.update(partFrame("leftFoot", [[1, 1]]), jumpTargets, 200);
    monitor.update(jumpFrame(40), jumpTargets, 300);
    monitor.update(jumpFrame(40), jumpTargets, 400);
    expect(events).toEqual([]);
  });

  it("does not fire for an element that does not accept jumps", () => {
    const { events, monitor } = monitorWithEvents();
    const targets = { "the-element": target(["hand"], 0) };
    monitor.update(jumpFrame(50), targets, 0);
    monitor.update(jumpFrame(40), targets, 100);
    monitor.update(jumpFrame(50), targets, 200);
    monitor.update(jumpFrame(50), targets, 300);
    expect(events).toEqual([]);
  });

  it("fires again for a second complete sequence", () => {
    expect(run([[50], [40], [30], [40], [40], [50], [40], [50], [50]])).toHaveLength(2);
  });
});

describe("PlayerMonitor stable frames", () => {
  const handTarget = { "the-element": target(["hand"], 0) };
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
    expect(events).toEqual([{ elementId: "the-element", interaction: "hand" }]);
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
