/**
 * What the model found in each frame of a real recording, cut down to what tracking and positions need, made by
 * `tests/tools/RecordingFixtures.test.ts`, so tracking fixes can be measured against real footage.
 */

/** One person the model found in a frame. */
export interface FixturePerson {
  /** How many pixels their outline has; 0 for an empty detection. */
  pixels: number;
  /** Their outline's centre, in mask pixels; null when it is empty. */
  centre: [x: number, y: number] | null;
  /** Their ground point, as percentages of the frame; null when it has none. */
  ground: [x: number, y: number] | null;
  /** How low their lower foot is, as a percentage of the frame's height; null when no foot was found. */
  feetY: number | null;
}

/** One frame the game used. */
export interface TrackingFixtureFrame {
  /** When it was given to the model, in milliseconds. */
  timestamp: number;
  /** Its time in the recording's video, in milliseconds. */
  videoMs: number;
  people: FixturePerson[];
}

/** A fixture: every frame of one recording, at the model's input size. */
export interface TrackingFixture {
  /** The recording's folder name, which is its zip's name. */
  recording: string;
  width: number;
  height: number;
  frames: TrackingFixtureFrame[];
}
