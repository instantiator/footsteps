import type { Corners } from "../components/camera/FloorGeometry";
import type { PlayerState } from "../components/camera/PlayerRegistry";
import type { PersonReadout } from "../components/camera/Spectators";
import type { AppConfig } from "../config/AppConfig";
import type { KeyPoints } from "../vision/VisionTypes";

/**
 * The shape of `recording.json` in a debug recording's zip, shared by the recorder and the tests that replay it.
 * Masks are separate files in the zip, one byte per pixel, row by row, named in each frame.
 */

/** The recording's format version, raised when the shape changes. */
export const RECORDING_VERSION = 1;

/** The recording's name inside the zip. */
export const RECORDING_JSON = "recording.json";

/** What was being recorded, and with which settings. */
export interface RecordingContext {
  /** The camera, as the player chose it. */
  camera?: {
    /** The browser's label for it. */
    label: string;
    /** The picture's size, in pixels. */
    width: number;
    /** The picture's size, in pixels. */
    height: number;
    /** Whether the picture is drawn mirrored. */
    mirror: boolean;
  };
  /** The calibrated floor's corners, in image fractions, if the scene has a floor. */
  floor?: Corners;
  /** The app's settings while recording: the model, tracking and spectator settings among them. */
  config: AppConfig;
}

/** One person the model found in a frame, before tracking. */
export interface RecordedDetection {
  /** The model's id for them in this frame. */
  id: number;
  /** Where the model placed their hands, feet and head, in mask pixels. */
  keyPoints: KeyPoints;
  /** The radius of a hand or foot, in mask pixels. */
  scale: number;
  /** The zip path of their mask. */
  mask: string;
  /** The zip path of the stray patches removed from their mask, if any were. */
  strays?: string;
}

/** One person as the game tracked them in a frame: their role, floor position and smoothed key points. */
export interface RecordedPlayer extends PersonReadout {
  /** Their tracked hands, feet and head, in mask pixels. */
  keyPoints: KeyPoints;
}

/** One frame the game processed. */
export interface RecordedFrameEntry {
  /** The frame's place in the recording, from 0. */
  index: number;
  /** When the frame was given to the model, in `performance.now()` milliseconds. */
  timestamp: number;
  /** Where the frame is in the video, in milliseconds from its start: seek here to see what the model saw. */
  videoMs: number;
  /** How long the model took, in milliseconds. */
  inferenceMs: number;
  /** The masks' width, in pixels. */
  width: number;
  /** The masks' height, in pixels. */
  height: number;
  /** Everyone the model found. */
  detected: RecordedDetection[];
  /** Everyone the game tracked, players and spectators. */
  players: RecordedPlayer[];
  /** Each player the game knows, by id, and what is happening to them; removed players are here, though not drawn. */
  states: Record<number, PlayerState>;
}

/** The scenes showing from a moment in a recording until the next entry. */
export interface RecordedScene {
  /** When they started showing, in milliseconds from the video's start; 0 for those showing as it started. */
  fromMs: number;
  /** The game's id. */
  game: string;
  /** The overview, stage and challenge scenes showing, by scope, as JSON. */
  scenes: string;
}

/** A label for a stretch of the recording (eg. "jump"), for 993's calibration game to fill in. */
export interface RecordingLabel {
  /** What was happening. */
  label: string;
  /** When it started, in milliseconds from the video's start. */
  fromMs: number;
  /** When it ended, in milliseconds from the video's start. */
  toMs: number;
}

/** The whole of `recording.json`. */
export interface Recording extends RecordingContext {
  /** {@link RECORDING_VERSION} when recorded. */
  version: number;
  /** When recording started, as an ISO date. */
  recordedAt: string;
  /** The video's zip path. */
  video: string;
  /** The video's MIME type. */
  videoType: string;
  /** The game's screen, recorded from the same moment as the camera, if it was shared (`recordingScreen`). */
  screen?: string;
  /** Labelled stretches of the recording; empty unless something labelled them. */
  labels: RecordingLabel[];
  /** The scenes played, in order. */
  scenes: RecordedScene[];
  /** Every frame processed while recording, in order. */
  frames: RecordedFrameEntry[];
}
