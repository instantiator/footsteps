/**
 * Hand-finding measured on real footage: camera session 1's recording R5 (waving, from behind), as a fixture of BodyPix's output (see `scripts/recording-fixture.ts`). BodyPix's own pose wrists,
 * where it is confident of both, stand in for the truth; they come from its pose, not the part labels being tested.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handsOf, type HandPixel } from "../src/vision/HandClumps";
import { keepSides } from "../src/vision/Tracking";
import { noKeyPoints, type KeyPoints, type Point } from "../src/vision/VisionTypes";
import type { FixtureWrist, HandsFixture, HandsFixtureFrame } from "./data/recordings/HandsFixture";

/** The fixtures, by recording. */
const FIXTURES = ["r5"].map(
  (name) => JSON.parse(readFileSync(`tests/data/recordings/session-1-${name}-hands.json`, "utf8")) as HandsFixture,
);

/** How confident BodyPix must be of both wrists for a frame to be scored. */
const MIN_WRIST_SCORE = 0.5;

/** How near a wrist a hand point must be to count as on that hand, as a share of the frame's width. */
const REACH = 0.06;

/** The hands as the game finds them: a hand radius at this size is about 16 px, as in the recordings. */
const MIN_GAP = 3 * 16;

type Hands = Pick<KeyPoints, "leftHand" | "rightHand">;

/** A frame's hand pixels, from its runs. */
const pixelsOf = ({ hands }: HandsFixtureFrame): HandPixel[] =>
  hands.flatMap(([x, y, length, left]) => Array.from({ length }, (_, i) => ({ x: x + i, y, left: left === 1 })));

/** The centre of some pixels, or null if there are none. */
const centreOf = (pixels: HandPixel[]): Point | null =>
  pixels.length === 0
    ? null
    : {
        x: Math.round(pixels.reduce((sum, { x }) => sum + x, 0) / pixels.length),
        y: Math.round(pixels.reduce((sum, { y }) => sum + y, 0) / pixels.length),
      };

/** The way hands were found before session 1: the centre of each label's pixels. */
const byLabel = (frame: HandsFixtureFrame): Hands => {
  const pixels = pixelsOf(frame);
  return {
    leftHand: centreOf(pixels.filter(({ left }) => left)),
    rightHand: centreOf(pixels.filter(({ left }) => !left)),
  };
};

/** The way they are found now, before the tracker. */
const byClump = (frame: HandsFixtureFrame): Hands => handsOf(pixelsOf(frame), MIN_GAP);

/** Which of the wrists a point is on, if it is within reach of one. */
const wristOf = (point: Point | null, wrists: FixtureWrist[], width: number): number | undefined => {
  if (!point) return undefined;
  const distances = wrists.map(({ x, y }) => Math.hypot(x - point.x, y - point.y));
  const nearest = distances.indexOf(Math.min(...distances));
  return distances[nearest] <= REACH * width ? nearest : undefined;
};

/** The hands found in each frame in turn, optionally kept to their sides as the tracker does. */
const handsIn = ({ frames }: HandsFixture, find: (frame: HandsFixtureFrame) => Hands, sides: boolean): Hands[] => {
  let before: Hands | undefined;
  return frames.map((frame) => {
    const found = find(frame);
    const hands = sides && before ? keepSides({ ...noKeyPoints(), ...found }, { ...noKeyPoints(), ...before }) : found;
    before = hands;
    return hands;
  });
};

/**
 * How some hands do on a fixture's scored frames: the share with each hand on its own wrist, and the share of
 * scored frames following another where the left hand moved to the other wrist.
 */
const score = ({ frames, width }: HandsFixture, hands: Hands[]) => {
  const onWrists = frames.map(({ wrists }, index) =>
    wrists.every(({ score }) => score >= MIN_WRIST_SCORE)
      ? [wristOf(hands[index].leftHand, wrists, width), wristOf(hands[index].rightHand, wrists, width)]
      : undefined,
  );
  const scored = onWrists.filter((sides) => sides !== undefined);
  const separated = scored.filter(([left, right]) => left !== undefined && right !== undefined && left !== right);
  const followed = onWrists.slice(1).flatMap((now, index) => {
    const before = onWrists[index];
    return now?.[0] !== undefined && before?.[0] !== undefined ? [now[0] !== before[0]] : [];
  });
  return {
    scored: scored.length,
    separated: separated.length / scored.length,
    swaps: followed.length === 0 ? 0 : followed.filter(Boolean).length / followed.length,
  };
};

describe.each(FIXTURES)("hands in $recording", (fixture) => {
  const old = score(fixture, handsIn(fixture, byLabel, false));
  const now = score(fixture, handsIn(fixture, byClump, true));

  it("has frames to score", () => {
    expect(old.scored).toBeGreaterThan(10);
  });

  it("puts the two hands on two different wrists more often than the labels did", () => {
    console.info(`${fixture.recording}: separated ${old.separated.toFixed(2)} → ${now.separated.toFixed(2)}`);
    expect(now.separated).toBeGreaterThan(old.separated);
    expect(now.separated).toBeGreaterThanOrEqual(0.8);
  });

  it("swaps a hand's name between frames no more often than the labels did", () => {
    console.info(`${fixture.recording}: swaps ${old.swaps.toFixed(2)} → ${now.swaps.toFixed(2)}`);
    expect(now.swaps).toBeLessThanOrEqual(old.swaps);
    expect(now.swaps).toBeLessThanOrEqual(0.05);
  });
});
