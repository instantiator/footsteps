/**
 * BodyPix's hands on frames of a real recording, made by `scripts/recording-fixture.ts`, so hand-finding can be
 * measured against real footage without running the model.
 */
/** A run of hand pixels along a row: where it starts, its length, and whether BodyPix called it the left hand (1). */
export type HandRun = [x: number, y: number, length: number, left: 0 | 1];

/** One of BodyPix's pose wrists, with its confidence (0–1). */
export interface FixtureWrist {
  left: boolean;
  x: number;
  y: number;
  score: number;
}

/** One frame the game used. */
export interface HandsFixtureFrame {
  /** The frame's index in the recording. */
  index: number;
  /** Its time in the recording's video. */
  videoMs: number;
  hands: HandRun[];
  wrists: FixtureWrist[];
}

/** A fixture: frames of one recording, at the model's input size. */
export interface HandsFixture {
  /** The recording's folder name, which is its zip's name. */
  recording: string;
  width: number;
  height: number;
  frames: HandsFixtureFrame[];
}
