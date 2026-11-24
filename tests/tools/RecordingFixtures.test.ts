/**
 * Makes a tracking fixture from an unzipped debug recording: each frame's people, cut down to what tracking and
 * positions need (see `TrackingFixture.ts`). It only runs when given a recording, so the normal suite never writes:
 *
 *   RECORDING=<unzipped recording> FIXTURE=tests/data/recordings/<name>.json npx vitest run tests/tools
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { expect, it } from "vitest";
import { groundPointOf } from "../../src/components/camera/PlayerPosition";
import { centreOf } from "../../src/vision/Tracking";
import { noKeyPoints, type KeyPoints } from "../../src/vision/VisionTypes";
import type { FixturePerson, TrackingFixture } from "../data/recordings/TrackingFixture";

const { RECORDING, FIXTURE } = process.env;

/** The parts of a recording's `recording.json` this reads (see `RecordingFormat.ts`, with the recorder). */
interface Recording {
  frames: {
    timestamp: number;
    videoMs: number;
    width: number;
    height: number;
    detected: { mask: string; keyPoints: KeyPoints }[];
  }[];
}

/** A number to one decimal place, to keep the fixture small. */
const tenth = (value: number) => Math.round(value * 10) / 10;

it.skipIf(!RECORDING || !FIXTURE)("makes a tracking fixture from a recording", () => {
  const folder = RECORDING!;
  const recording = JSON.parse(readFileSync(join(folder, "recording.json"), "utf8")) as Recording;
  const [first] = recording.frames;
  const frames = recording.frames.map(({ timestamp, videoMs, width, height, detected }) => ({
    timestamp: Math.round(timestamp),
    videoMs: Math.round(videoMs),
    people: detected.map(({ mask: path, keyPoints }): FixturePerson => {
      const mask = new Uint8Array(readFileSync(join(folder, path)));
      const centre = centreOf({ id: 0, mask, keyPoints: noKeyPoints(), scale: 1 }, width);
      const ground = groundPointOf(mask, width);
      const feet = [keyPoints.leftFoot?.y, keyPoints.rightFoot?.y].filter((y) => y !== undefined);
      return {
        pixels: mask.reduce((sum, pixel) => sum + pixel, 0),
        centre: centre && [tenth(centre.x), tenth(centre.y)],
        ground: ground && [tenth(ground.x), tenth(ground.y)],
        feetY: feet.length > 0 ? tenth((Math.max(...feet) / height) * 100) : null,
      };
    }),
  }));
  const fixture: TrackingFixture = { recording: basename(folder), width: first.width, height: first.height, frames };
  writeFileSync(FIXTURE!, JSON.stringify(fixture));
  expect(frames.length).toBe(recording.frames.length);
});
