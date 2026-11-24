/**
 * Tracking and positions measured on real footage: camera session 1's recordings R3 (walking front to back), R4 (the
 * same, then jumping) and R5 (waving, with arms raised at the back), as fixtures of what the model found (see
 * `tests/tools/RecordingFixtures.test.ts`). They replay through the same code the game runs.
 */
import _ from "lodash";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PositionFollower } from "../src/components/camera/PlayerPosition";
import { DEFAULT_APP_CONFIG } from "../src/config/AppConfig";
import { PersonTracker } from "../src/vision/Tracking";
import { noKeyPoints, type VisionFrame } from "../src/vision/VisionTypes";
import type { TrackingFixture } from "./data/recordings/TrackingFixture";

/** A fixture, by its recording's name in the session write-up. */
const fixture = (name: string) =>
  JSON.parse(readFileSync(`tests/data/recordings/session-1-${name}-tracking.json`, "utf8")) as TrackingFixture;

/** The depth settings the game uses now, and the ones session 1 found too slow. */
const SETTINGS = {
  now: { windowMs: DEFAULT_APP_CONFIG.cameraDepthWindowMs, deadband: DEFAULT_APP_CONFIG.cameraDepthDeadband },
  before: { windowMs: 700, deadband: 2 },
};

/** The player's ground point, and where the follower puts them, at each frame between two video times. */
const follow = ({ frames }: TrackingFixture, settings: { windowMs: number; deadband: number }, fromMs = 0) => {
  const follower = new PositionFollower(settings);
  return frames.flatMap(({ timestamp, videoMs, people }) => {
    const ground = people[0]?.ground;
    if (!ground || videoMs < fromMs) return [];
    const followed = follower.update({ x: ground[0], y: ground[1] }, timestamp);
    return [{ timestamp, videoMs, seen: ground[1], followed: followed.y }];
  });
};

/** How far, in ms, the follower runs behind the ground point: the delay that best lines the two up. */
const lagMs = (track: ReturnType<typeof follow>) => {
  const error = (delay: number) => {
    let total = 0;
    for (const { timestamp, followed } of track) {
      const earlier = _.findLast(track, ({ timestamp: t }) => t <= timestamp - delay) ?? track[0];
      total += (followed - earlier.seen) ** 2;
    }
    return total;
  };
  const delays = Array.from({ length: 21 }, (_, i) => i * 50);
  return delays.reduce((best, delay) => (error(delay) < error(best) ? delay : best));
};

describe("depth on real footage (session 1, F3)", () => {
  // R3's walking, front to back and back again twice, once the player is in view
  const walking = fixture("r3");

  it("follows a walking player within about 150 ms, where the old settings ran 500 ms or more behind", () => {
    const [now, before] = [
      lagMs(follow(walking, SETTINGS.now, 11_000)),
      lagMs(follow(walking, SETTINGS.before, 11_000)),
    ];
    console.info(`R3 depth lag: ${before} ms → ${now} ms`);
    expect(now).toBeLessThanOrEqual(150);
    expect(before).toBeGreaterThanOrEqual(500);
  });

  it("moves for one frame at most through each of R4's two jumps", () => {
    // R4's player stood with ground points from 71 to 75 throughout; only feet in the air read lower
    const track = follow(fixture("r4"), SETTINGS.now);
    const jumping = track.filter(({ videoMs }) => videoMs >= 11_700 && videoMs <= 13_200);
    const leaked = jumping.filter(({ followed }) => followed < 70);
    console.info(`R4 frames moved back by the jumps: ${leaked.length}, of ${jumping.length}`);
    expect(jumping.some(({ seen }) => seen < 70)).toBe(true);
    expect(leaked.length).toBeLessThanOrEqual(2);
  });
});

describe("stand-ins on real footage (session 1, F4)", () => {
  // A new person only after the model loses them for longer than they're held: R5 has two such gaps
  it("follows R5's one player as one person between gaps, though the model reports some with no pixels", () => {
    const { frames, width, height } = fixture("r5");
    const tracker = new PersonTracker({
      holdMs: DEFAULT_APP_CONFIG.cameraHoldMs,
      fadeMs: DEFAULT_APP_CONFIG.cameraFadeMs,
    });
    const ids = new Set<number>();
    for (const { timestamp, people } of frames) {
      const frame: VisionFrame = {
        width,
        height,
        timestamp,
        // Only an outline's centre matters to the tracker, so each is one pixel there, or none for an empty one
        people: people.map(({ centre }, id) => {
          const mask = new Uint8Array(width * height);
          if (centre) mask[Math.round(centre[1]) * width + Math.round(centre[0])] = 1;
          return { id, mask, keyPoints: noKeyPoints(), scale: 1 };
        }),
      };
      for (const { id, held } of tracker.update(frame).people) if (!held) ids.add(id);
    }
    console.info(`R5 people followed: ${ids.size} (34 in session 1)`);
    expect(ids.size).toBeLessThanOrEqual(3);
  });
});
