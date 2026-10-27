import { describe, expect, it } from "vitest";
import { fillFromPrevious, OneEuroFilter, PersonTracker } from "../src/vision/Tracking";
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

describe("PersonTracker holding", () => {
  const hold = { holdMs: 400, fadeMs: 300 };

  it("holds someone the model loses, as they were, then fades them out, then lets them go", () => {
    const tracker = new PersonTracker(hold);
    const [seen] = tracker.update(frame(0, personAt(0, 20))).people;

    const [held] = tracker.update(frame(200)).people;
    expect(held).toMatchObject({ id: seen.id, held: { opacity: 1 } });
    expect(held.mask).toBe(seen.mask);

    expect(tracker.update(frame(550)).people[0].held?.opacity).toBeCloseTo(0.5);
    expect(tracker.update(frame(700)).people).toEqual([]);
  });

  it("shows someone found again as themselves, with the same id, not held", () => {
    const tracker = new PersonTracker(hold);
    const [seen] = tracker.update(frame(0, personAt(0, 20))).people;
    tracker.update(frame(200));

    const found = tracker.update(frame(400, personAt(0, 22))).people;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: seen.id });
    expect(found[0].held).toBeUndefined();
  });

  it("follows someone who moves, leaving nobody held behind them", () => {
    const tracker = new PersonTracker(hold);
    tracker.update(frame(0, personAt(0, 20)));
    const people = tracker.update(frame(33, personAt(0, 30))).people;
    expect(people).toHaveLength(1);
    expect(people[0].held).toBeUndefined();
  });

  it("holds nobody by default", () => {
    const tracker = new PersonTracker();
    tracker.update(frame(0, personAt(0, 20)));
    expect(tracker.update(frame(33)).people).toEqual([]);
  });
});

describe("fillFromPrevious", () => {
  // 4×2 masks, row by row
  it("lays the frame before's mask, moved by the offset, over the mask, and leaves both unchanged", () => {
    const mask = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]);
    const previous = Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 1]);
    const filled = fillFromPrevious(mask, previous, 4, { x: 1, y: 0 });
    expect(Array.from(filled)).toEqual([1, 0, 1, 0, 0, 0, 0, 0]); // the pixel moved off the right edge is dropped
    expect(Array.from(mask)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("moves the frame before's mask up and left too", () => {
    const previous = Uint8Array.from([0, 0, 0, 0, 0, 0, 1, 0]);
    expect(Array.from(fillFromPrevious(new Uint8Array(8), previous, 4, { x: -1, y: -1 }))).toEqual([
      0, 1, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("PersonTracker gap filling", () => {
  /** A person at column `x` with their hand placed, whose legs (the bottom half of the frame) the model missed. */
  const withoutLegs = (x: number): VisionPerson => {
    const person = personAt(0, x, { x, y: 2 });
    person.mask.fill(0, (WIDTH * HEIGHT) / 2);
    return person;
  };
  const legPixel = (x: number) => (HEIGHT - 1) * WIDTH + x;

  it("fills legs the model missed for a frame from the frame before, moved with the person, for drawing only", () => {
    const tracker = new PersonTracker(undefined, true);
    tracker.update(frame(0, personAt(0, 20, { x: 20, y: 2 })));
    const [person] = tracker.update(frame(33, withoutLegs(22))).people;

    // Moved two pixels right with the hand, though the silhouette's centre rose as the legs went
    expect(person.filled?.[legPixel(22 + 2)]).toBe(1);
    expect(person.filled?.[legPixel(22 - 3)]).toBe(0);
    expect(person.mask[legPixel(22)]).toBe(0);
  });

  it("drops legs missing for a second frame, as only the frame before is used", () => {
    const tracker = new PersonTracker(undefined, true);
    tracker.update(frame(0, personAt(0, 20)));
    tracker.update(frame(33, withoutLegs(20)));
    const [person] = tracker.update(frame(66, withoutLegs(20))).people;
    expect(person.filled?.[legPixel(20)]).toBe(0);
  });

  it("fills nothing when off", () => {
    const tracker = new PersonTracker();
    tracker.update(frame(0, personAt(0, 20)));
    expect(tracker.update(frame(33, withoutLegs(20))).people[0].filled).toBeUndefined();
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
