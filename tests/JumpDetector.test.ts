import { describe, expect, it } from "vitest";
import { JumpDetector, jumpSettingsOf, type JumpEvent } from "../src/components/camera/JumpDetector";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";

/** The defaults from `.env`: a rise of 4% of height, jitter of 2%, half the rise back down, within a second. */
const SETTINGS = jumpSettingsOf(DEFAULT_APP_CONFIG);

/** A child's height in mask pixels; their feet stand at {@link GROUND}. */
const CHILD = 100;
const GROUND = 500;

/** Feeds feet heights (null when unseen) at the given interval, and returns each frame's event with its time. */
const run = (feet: (number | null)[], intervalMs: number, bodyHeight = CHILD) => {
  const detector = new JumpDetector(SETTINGS);
  return feet.flatMap((feetY, index): [number, JumpEvent][] => {
    const event = detector.update(feetY, bodyHeight, index * intervalMs);
    return event ? [[index * intervalMs, event]] : [];
  });
};

/** Feet standing at the ground for long enough to take off from it. */
const standing = (frames: number) => Array<number>(frames).fill(GROUND);

/** Feet moving from one height to another over the given number of frames. */
const moving = (from: number, to: number, frames: number) =>
  Array.from({ length: frames }, (_, i) => from + ((to - from) * (i + 1)) / frames);

describe("JumpDetector at 5 fps", () => {
  const FIVE_FPS = 200;

  it("lands a jump on the spot seen in a single frame in the air", () => {
    // An 8 cm hop for a child: up in one frame, down in the next
    expect(run([...standing(2), GROUND - 8, GROUND], FIVE_FPS)).toEqual([
      [400, "takeoff"],
      [600, "landed"],
    ]);
  });

  it("lands a jump forward, onto feet lower in the image than the ground left", () => {
    expect(run([...standing(2), GROUND - 8, GROUND + 10], FIVE_FPS).at(-1)).toEqual([600, "landed"]);
  });

  it("lands a jump back, onto feet higher in the image, once they come down half the rise", () => {
    expect(run([...standing(2), GROUND - 8, GROUND - 3], FIVE_FPS).at(-1)).toEqual([600, "landed"]);
  });

  it("still lands when the feet are lost for a frame in the air", () => {
    expect(run([...standing(2), GROUND - 8, null, GROUND], FIVE_FPS).at(-1)).toEqual([800, "landed"]);
  });

  it("abandons a rise that never comes down, as stepping back does, and stands there afterwards", () => {
    const stepBack = [...standing(2), ...Array<number>(7).fill(GROUND - 8)];
    expect(run(stepBack, FIVE_FPS)).toEqual([[400, "takeoff"]]);

    // From the new ground, a hop lands
    const events = run([...stepBack, GROUND - 16, GROUND - 8], FIVE_FPS);
    expect(events.at(-1)).toEqual([2000, "landed"]);
  });

  it("ignores walking forward, which only lowers the feet", () => {
    expect(run([...standing(2), GROUND + 5, GROUND + 10, GROUND + 15], FIVE_FPS)).toEqual([]);
  });

  it("ignores the feet jittering within the still tolerance", () => {
    expect(run([GROUND, GROUND - 1.5, GROUND + 1, GROUND - 2, GROUND, GROUND - 1], FIVE_FPS)).toEqual([]);
  });

  it("needs the feet to stand still before a take-off counts", () => {
    expect(run([GROUND, GROUND - 8, GROUND], FIVE_FPS)).toEqual([]);
  });

  it("measures against the player's height, so a child's small hop counts and the same pixels from an adult don't", () => {
    const hop = [...standing(2), GROUND - 5, GROUND];
    expect(run(hop, FIVE_FPS, CHILD).at(-1)).toEqual([600, "landed"]);
    expect(run(hop, FIVE_FPS, 2 * CHILD)).toEqual([]);
  });
});

describe("JumpDetector at 30 fps", () => {
  const THIRTY_FPS = 33;

  it("lands a jump that rises and falls over several frames", () => {
    // Up 8 over 150 ms, each frame's step inside the still tolerance, then down again
    const events = run(
      [...standing(6), ...moving(GROUND, GROUND - 8, 5), ...moving(GROUND - 8, GROUND, 5)],
      THIRTY_FPS,
    );
    expect(events.map(([, event]) => event)).toEqual(["takeoff", "landed"]);
  });

  it("abandons a rise that is still rising after the longest rise allowed", () => {
    // Up 20 over 700 ms, then back down: too slow to be a jump
    const slow = [...standing(6), ...moving(GROUND, GROUND - 20, 21), ...moving(GROUND - 20, GROUND, 5)];
    expect(run(slow, THIRTY_FPS).map(([, event]) => event)).not.toContain("landed");
  });
});
