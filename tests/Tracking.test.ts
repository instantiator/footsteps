import { describe, expect, it } from "vitest";
import { OneEuroFilter, PersonTracker } from "../src/vision/Tracking";
import { noKeyPoints, type Point, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 100;
const HEIGHT = 10;

/** A person a few columns wide centred at column `x`, with their left hand at `hand`. */
const personAt = (id: number, x: number, hand: Point | null = null): VisionPerson => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let dx = -2; dx <= 2; dx++) mask[y * WIDTH + x + dx] = 1;
  return { id, mask, keyPoints: { ...noKeyPoints(), leftHand: hand }, scale: 1 };
};

const frame = (timestamp: number, ...people: VisionPerson[]): VisionFrame => ({
  width: WIDTH,
  height: HEIGHT,
  timestamp,
  people,
});

describe("PersonTracker ids", () => {
  it("keeps each person's id when the model lists them in a different order", () => {
    const tracker = new PersonTracker();
    const first = tracker.update(frame(0, personAt(0, 20), personAt(1, 80)));
    const second = tracker.update(frame(33, personAt(0, 82), personAt(1, 21)));
    expect(second.people.map(({ id }) => id)).toEqual([first.people[1].id, first.people[0].id]);
  });

  it("gives a new id to someone who appears", () => {
    const tracker = new PersonTracker();
    const [a] = tracker.update(frame(0, personAt(0, 20))).people;
    const [, b] = tracker.update(frame(33, personAt(0, 20), personAt(1, 80))).people;
    expect(b.id).not.toBe(a.id);
  });

  it("gives a new id to someone who jumps further than a person could move in a frame", () => {
    const tracker = new PersonTracker();
    const [a] = tracker.update(frame(0, personAt(0, 10))).people;
    const [b] = tracker.update(frame(33, personAt(0, 90))).people;
    expect(b.id).not.toBe(a.id);
  });

  it("forgets someone unseen for too long", () => {
    const tracker = new PersonTracker();
    const [a] = tracker.update(frame(0, personAt(0, 20))).people;
    tracker.update(frame(1000));
    const [b] = tracker.update(frame(1033, personAt(0, 20))).people;
    expect(b.id).not.toBe(a.id);
  });
});

describe("PersonTracker smoothing", () => {
  it("damps jitter in a key point", () => {
    const tracker = new PersonTracker();
    const xs = [50, 54, 46, 54, 46, 54].map(
      (x, i) => tracker.update(frame(i * 33, personAt(0, 20, { x, y: 5 }))).people[0].keyPoints.leftHand!.x,
    );
    expect(Math.max(...xs.slice(1)) - Math.min(...xs.slice(1))).toBeLessThan(4);
  });

  it("starts afresh when a key point goes missing and comes back", () => {
    const tracker = new PersonTracker();
    tracker.update(frame(0, personAt(0, 20, { x: 10, y: 5 })));
    expect(tracker.update(frame(33, personAt(0, 20))).people[0].keyPoints.leftHand).toBeNull();
    expect(tracker.update(frame(66, personAt(0, 20, { x: 40, y: 5 }))).people[0].keyPoints.leftHand).toEqual({
      x: 40,
      y: 5,
    });
  });
});

describe("OneEuroFilter", () => {
  it("passes the first sample through", () => {
    expect(new OneEuroFilter().filter(7, 0)).toBe(7);
  });

  it("follows a step change, quickly once it is moving fast", () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 0);
    let value = 0;
    for (let i = 1; i <= 15; i++) value = filter.filter(100, i * 33);
    expect(value).toBeGreaterThan(90);
  });

  it("ignores a sample with no time since the last", () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 10);
    expect(filter.filter(100, 10)).toBe(0);
  });
});
