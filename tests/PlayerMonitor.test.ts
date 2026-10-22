import { describe, expect, it, vi } from "vitest";

vi.mock("@tensorflow-models/body-segmentation", () => ({}));

import {
  PlayerMonitor,
  type MonitorTarget,
  type PlayerFrame,
  type PlayerMonitorEvent,
} from "../src/components/camera/PlayerMonitor";
import { BODY_PARTS } from "../src/components/camera/BodySegSupport";
import type { FootPosition, MaskRect } from "../src/components/camera/CameraSupport";

const WIDTH = 10;
const HEIGHT = 10;

const HAND = BODY_PARTS.LEFT_HAND.maskValue;
const OTHER_HAND = BODY_PARTS.RIGHT_HAND.maskValue;
const FOOT = BODY_PARTS.LEFT_FOOT.maskValue;
const FACE = BODY_PARTS.LEFT_FACE.maskValue;
const ARM = BODY_PARTS.LEFT_UPPER_ARM_FRONT.maskValue;

/** A transparent mask with the given mask value at each (x, y) pixel. */
const mask = (pixels: [x: number, y: number, part: number][]) => {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (const [x, y, part] of pixels) {
    const i = (y * WIDTH + x) * 4;
    data[i] = part;
    data[i + 3] = 255;
  }
  return { data, width: WIDTH, height: HEIGHT };
};

/** A frame whose player has the given pixels, with their feet wherever the test puts them. */
const frame = (pixels: [x: number, y: number, part: number][], feet: FootPosition | null = null): PlayerFrame => ({
  id: 1,
  mask: mask(pixels),
  feet,
});

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

/** A fresh monitor and the events it reports. */
const monitorWithEvents = () => {
  const events: PlayerMonitorEvent[] = [];
  return { events, monitor: new PlayerMonitor((event) => events.push(event)) };
};

describe("PlayerMonitor coverage", () => {
  it.each([
    ["hand", HAND],
    ["hand", OTHER_HAND],
    ["foot", FOOT],
    ["head", FACE],
  ] as const)("fires a %s interaction when that body part is inside", (interaction, part) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(frame([[1, 1, part]]), { "the-element": target([interaction], 0) }, 0);
    expect(events).toEqual([{ elementId: "the-element", interaction }]);
  });

  it("counts every body part for a body interaction", () => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(
      frame([
        [1, 1, ARM],
        [2, 2, FACE],
      ]),
      { "the-element": target(["body"], 0) },
      0,
    );
    expect(events).toEqual([{ elementId: "the-element", interaction: "body" }]);
  });

  it("applies the threshold to each part separately for an any interaction", () => {
    const { events, monitor } = monitorWithEvents();
    // The hand is only half inside, but the foot is entirely inside
    monitor.update(
      frame([
        [1, 1, HAND],
        [8, 8, HAND],
        [2, 2, FOOT],
      ]),
      { "the-element": target(["any"], 1) },
      0,
    );
    expect(events).toEqual([{ elementId: "the-element", interaction: "any" }]);
  });
});

describe("PlayerMonitor thresholds", () => {
  /** Whether a hand pixel inside and another outside fires at the given threshold. */
  const firesAt = (threshold: number, pixels: [number, number, number][]) => {
    const { events, monitor } = monitorWithEvents();
    monitor.update(frame(pixels), { "the-element": target(["hand"], threshold) }, 0);
    return events.length === 1;
  };

  it("fires at threshold 0 with a single pixel inside, even with the rest outside", () => {
    expect(
      firesAt(0, [
        [1, 1, HAND],
        [8, 8, HAND],
        [9, 9, HAND],
      ]),
    ).toBe(true);
  });

  it("fires at threshold 0.5 when half of the part is inside", () => {
    expect(
      firesAt(0.5, [
        [1, 1, HAND],
        [8, 8, HAND],
      ]),
    ).toBe(true);
    expect(
      firesAt(0.5, [
        [1, 1, HAND],
        [8, 8, HAND],
        [9, 9, HAND],
      ]),
    ).toBe(false);
  });

  it("fires at threshold 1 only when the whole part is inside", () => {
    expect(
      firesAt(1, [
        [1, 1, HAND],
        [2, 2, HAND],
      ]),
    ).toBe(true);
    expect(
      firesAt(1, [
        [1, 1, HAND],
        [8, 8, HAND],
      ]),
    ).toBe(false);
  });

  it("clamps a threshold above 1 to a whole part", () => {
    expect(
      firesAt(1.01, [
        [1, 1, HAND],
        [2, 2, HAND],
      ]),
    ).toBe(true);
  });

  it("does not fire when nothing is inside", () => {
    expect(firesAt(0, [[8, 8, HAND]])).toBe(false);
  });
});

describe("PlayerMonitor edge triggering", () => {
  const handTarget = { "the-element": target(["hand"], 0) };
  const inside = frame([[1, 1, HAND]]);
  const outside = frame([[8, 8, HAND]]);

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
      frame([
        [1, 1, HAND],
        [8, 8, HAND],
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
    frame([[inside ? 1 : 8, inside ? 1 : 8, FOOT]], feetAt(percentY));

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
    monitor.update(frame([[1, 1, FOOT]], null), jumpTargets, 200);
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
