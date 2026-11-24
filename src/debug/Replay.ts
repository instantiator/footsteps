/**
 * Reading a debug recording back, and drawing what the game saw over its video, for the replay page and the tests.
 */
import { strFromU8, unzipSync } from "fflate";
import _ from "lodash";
import { tintPixels } from "../components/camera/DrawPeople";
import { noKeyPoints, type KeyPointName } from "../vision/VisionTypes";
import {
  RECORDING_JSON,
  type RecordedFrameEntry,
  type RecordedPlayer,
  type RecordedScene,
  type Recording,
} from "./RecordingFormat";

/** A downloaded debug recording, unzipped: its `recording.json`, and every file by its zip path. */
export interface UnzippedRecording {
  /** The frames and what was recorded with. */
  recording: Recording;
  /** The videos and masks, by zip path. */
  files: Record<string, Uint8Array>;
}

/** A `recording.json` as first recorded: its scenes and the players' states came later (camera session 1's have neither). */
type FirstRecording = Omit<Recording, "scenes" | "frames"> & {
  scenes?: Recording["scenes"];
  frames: (Omit<RecordedFrameEntry, "states"> & { states?: RecordedFrameEntry["states"] })[];
};

/** Unzips a debug recording, as the HUD's Download button saves it; an older one gets no scenes and no states. */
export const readRecording = (zip: Uint8Array): UnzippedRecording => {
  const files = unzipSync(zip);
  const json = files[RECORDING_JSON];
  if (!json) throw new Error(`Not a debug recording: it has no ${RECORDING_JSON}`);
  const read = JSON.parse(strFromU8(json)) as FirstRecording;
  const frames = read.frames.map((frame) => ({ ...frame, states: frame.states ?? {} }));
  return { recording: { ...read, scenes: read.scenes ?? [], frames }, files };
};

/** The frame the game was working on at a time in the video: the last given to the model by then; none before the first. */
export const frameAt = ({ frames }: Recording, videoMs: number): RecordedFrameEntry | undefined =>
  _.findLast(frames, (frame) => frame.videoMs <= videoMs);

/** The scenes showing at a time in the video. */
export const scenesAt = ({ scenes }: Recording, videoMs: number): RecordedScene | undefined =>
  _.findLast(scenes, (scene) => scene.fromMs <= videoMs);

/** The key points marked on the overlay, and their colours. */
const MARKS: [KeyPointName[], string][] = [
  [["leftHand", "rightHand"], "#ffd166"],
  [["leftFoot", "rightFoot"], "#06d6a0"],
  [["headTop", "headBottom"], "#ef476f"],
];

/** Draws a tracked player's key points, and a label by their head: their number, role and state, and where they stand. */
const drawPlayer = (
  ctx: CanvasRenderingContext2D,
  { number, role, position, keyPoints }: RecordedPlayer,
  state: string | undefined,
) => {
  for (const [names, colour] of MARKS) {
    ctx.fillStyle = colour;
    for (const point of names.map((name) => keyPoints[name])) if (point) ctx.fillRect(point.x - 6, point.y - 6, 12, 12);
  }
  const at = keyPoints.headTop ?? keyPoints.leftFoot ?? keyPoints.rightFoot;
  if (!at) return;
  const where = position ? ` (${Math.round(position.x)}, ${Math.round(position.y)})` : "";
  ctx.fillStyle = "#fff";
  ctx.fillText(`P${number ?? "?"} ${role} ${state ?? ""}${where}`, at.x + 8, Math.max(at.y, ctx.canvas.height / 30));
};

/**
 * Draws a frame onto a canvas the size of its masks: the outlines, tinted per person as debug mode does, then each
 * tracked player, with their key points and a label.
 */
export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  { detected, players, states, width, height }: RecordedFrameEntry,
  files: UnzippedRecording["files"],
): void => {
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  const people = detected.map(({ id, mask, strays }) => ({
    id,
    mask: files[mask] ?? new Uint8Array(width * height),
    strays: strays ? files[strays] : undefined,
    keyPoints: noKeyPoints(),
    scale: 1,
  }));
  ctx.putImageData(new ImageData(tintPixels({ width, height, timestamp: 0, people }), width, height), 0, 0);
  ctx.font = `${Math.round(height / 30)}px sans-serif`;
  for (const player of players) drawPlayer(ctx, player, states[player.id]);
};
