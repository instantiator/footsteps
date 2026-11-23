/**
 * Makes a vision test fixture from a debug recording, so fixes can be measured against real footage: BodyPix (on the
 * CPU, so slowly: a few seconds a frame) runs on the frames the game used in the given stretches, and each frame's
 * hand pixels and pose wrists are saved. Needs ffmpeg.
 *
 *   node scripts/recording-fixture.ts <unzipped recording> <fixture.json> <from s>-<to s> [<from s>-<to s> ...]
 */
import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { HandRun, HandsFixture, HandsFixtureFrame } from "../tests/data/recordings/HandsFixture.ts";

/** BodyPix's left and right hand part ids. */
const HANDS = { left: 10, right: 11 };

/** The parts of a recording's JSON this reads. */
interface Recording {
  config: {
    bodypixInternalResolution: "low" | "medium" | "high" | "full";
    bodypixThreshold: number;
    bodypixRefineSteps: number;
  };
  frames: { index: number; videoMs: number; width: number; height: number; detected: unknown[] }[];
}

/** One frame of the video at a time, as RGB bytes at the given size. */
const frameAt = (video: string, seconds: number, width: number, height: number): Buffer =>
  execFileSync(
    "ffmpeg",
    // prettier-ignore
    [
      "-loglevel", "error", "-ss", String(seconds), "-i", video, "-frames:v", "1",
      "-vf", `scale=${width}:${height}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ],
    { maxBuffer: width * height * 3 },
  );

/** A part map's hand pixels as runs along each row. */
const handRuns = ({ data, width }: bodyPix.PartSegmentation): HandRun[] => {
  const runs: HandRun[] = [];
  for (let i = 0; i < data.length; i++) {
    const part = data[i];
    if (part !== HANDS.left && part !== HANDS.right) continue;
    const start = i;
    while (i + 1 < data.length && data[i + 1] === part && (i + 1) % width !== 0) i++;
    runs.push([start % width, Math.floor(start / width), i - start + 1, part === HANDS.left ? 1 : 0]);
  }
  return runs;
};

const [folder, out, ...spans] = process.argv.slice(2);
if (!folder || !out || spans.length === 0) {
  console.error("Usage: node scripts/recording-fixture.ts <unzipped recording> <fixture.json> <from>-<to> ...");
  process.exit(1);
}
const recording = JSON.parse(readFileSync(join(folder, "recording.json"), "utf8")) as Recording;
const ranges = spans.map((span) => span.split("-").map(Number));
const chosen = recording.frames.filter(
  ({ videoMs, detected }) =>
    detected.length > 0 && ranges.some(([from, to]) => videoMs >= from * 1000 && videoMs <= to * 1000),
);

await tf.setBackend("cpu");
const { config } = recording;
const net = await bodyPix.load({ architecture: "MobileNetV1", outputStride: 16, multiplier: 0.75, quantBytes: 2 });
const frames: HandsFixtureFrame[] = [];
for (const { index, videoMs, width, height } of chosen) {
  const image = tf.tensor3d(
    new Uint8Array(frameAt(join(folder, "video.webm"), videoMs / 1000, width, height)),
    [height, width, 3],
    "int32",
  );
  const people = await net.segmentMultiPersonParts(image, {
    internalResolution: config.bodypixInternalResolution,
    segmentationThreshold: config.bodypixThreshold,
    maxDetections: 1,
    refineSteps: config.bodypixRefineSteps,
  });
  image.dispose();
  const [person] = people;
  if (!person) continue;
  const wrists = person.pose.keypoints
    .filter(({ part }) => part === "leftWrist" || part === "rightWrist")
    .map(({ part, position, score }) => ({
      left: part === "leftWrist",
      x: Math.round(position.x),
      y: Math.round(position.y),
      score: Number(score.toFixed(2)),
    }));
  frames.push({ index, videoMs: Math.round(videoMs), hands: handRuns(person), wrists });
  console.log(`frame ${index} at ${(videoMs / 1000).toFixed(2)} s: ${frames.at(-1)?.hands.length} hand runs`);
}
const fixture: HandsFixture = {
  recording: basename(folder),
  width: chosen[0]?.width ?? 0,
  height: chosen[0]?.height ?? 0,
  frames,
};
writeFileSync(out, JSON.stringify(fixture));
