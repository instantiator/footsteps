import type { GameInteraction } from "../../entities/data/displays/GameDisplayData";
import { isDefined } from "../../util/ObjectUtils";
import { BODY_PARTS, BodyPart } from "../../vision/BodyPart";
import { bodyPartsIn } from "../../vision/VisionQueries";
import type { VisionPerson } from "../../vision/VisionTypes";
import type { FootPosition, MaskRect } from "./CameraSupport";

/** Interactions the player monitor can detect through the camera. */
export type CameraInteraction = Exclude<GameInteraction, "click">;

/** One player, as the camera saw them in a frame: the model's view of them, in a mask of the given size. */
export interface PlayerFrame extends VisionPerson {
  /** Mask width, in pixels. */
  width: number;
  /** Mask height, in pixels. */
  height: number;
  /** Where the player's feet are, or null when they are not visible. */
  feet: FootPosition | null;
}

/** Something a player did to an element. */
export interface PlayerMonitorEvent {
  /** Id of the element the player interacted with. */
  elementId: string;
  /** What the player did. */
  interaction: CameraInteraction;
}

/** An element the player can interact with, and where it is in the mask. */
export interface MonitorTarget {
  /** The element's bounds in mask pixels. */
  rect: MaskRect;
  /** The interactions the element accepts; unknown values are ignored when the monitor runs. */
  interactions: readonly string[];
  /** Fraction of the body part that must be inside the element (0–1). */
  threshold: number;
}

/** Interactions detected from how much of a body part is inside an element. */
type CoverageInteraction = Exclude<CameraInteraction, "jump">;

/** The body parts each coverage interaction looks for; any one of them over the element counts. */
const PART_GROUPS: Record<CoverageInteraction, readonly BodyPart[]> = {
  hand: [BodyPart.LEFT_HAND, BodyPart.RIGHT_HAND],
  foot: [BodyPart.LEFT_FOOT, BodyPart.RIGHT_FOOT],
  head: [BodyPart.HEAD],
  body: [BodyPart.BODY],
  any: BODY_PARTS,
};

/** Vertical speed, in frame heights per second, above which the player counts as moving. */
const JUMP_SPEED_THRESHOLD = 0.3;

/** How long a jump sequence may take, in milliseconds, before it is abandoned. */
const JUMP_SEQUENCE_WINDOW_MS = 1500;

/** The stages of a jump: the player rises, falls, then comes to rest inside the element. */
type JumpPhase = "ready" | "rising" | "falling";

/** Where one player is in a jump sequence for one element. */
interface JumpState {
  /** The phase of the sequence. */
  phase: JumpPhase;
  /** When the sequence started, in milliseconds. */
  since: number;
}

/** What one frame means for a target's coverage. */
interface TargetCoverage {
  /** The fraction of each body part that is inside the target; parts with none inside are absent. */
  proportions: Map<BodyPart, number>;
  /** The target's threshold, clamped to the range it means. */
  threshold: number;
}

/** Whether a value is an interaction the monitor understands, including unknown values from game data. */
const isCameraInteraction = (value: string): value is CameraInteraction =>
  value === "hand" || value === "foot" || value === "head" || value === "body" || value === "any" || value === "jump";

/** Clamps an authored threshold to the range it means. */
const clampThreshold = (threshold: number): number => Math.min(Math.max(threshold, 0), 1);

/** Whether enough of any of the interaction's body parts is inside the element. */
const isCovered = (interaction: CoverageInteraction, { proportions, threshold }: TargetCoverage): boolean =>
  PART_GROUPS[interaction].some((part) => {
    const proportion = proportions.get(part);
    return proportion !== undefined && proportion >= threshold;
  });

/** Whether a jump sequence has been running too long to complete. */
const jumpExpired = (state: JumpState, timestamp: number): boolean =>
  state.phase !== "ready" && timestamp - state.since > JUMP_SEQUENCE_WINDOW_MS;

/** The phase a jump moves to this frame, and whether that completes the sequence. */
const nextJumpPhase = (phase: JumpPhase, velocity: number): { phase: JumpPhase; completed: boolean } => {
  if (phase === "ready") return { phase: velocity < -JUMP_SPEED_THRESHOLD ? "rising" : phase, completed: false };
  if (phase === "rising") return { phase: velocity > JUMP_SPEED_THRESHOLD ? "falling" : phase, completed: false };
  return Math.abs(velocity) <= JUMP_SPEED_THRESHOLD ? { phase: "ready", completed: true } : { phase, completed: false };
};

/**
 * Turns one player's segmentation frames into interaction events.
 *
 * Events are edge-triggered: an interaction fires when it begins, not on every frame it holds.
 * The first frame only records what already holds, so a player who is already inside an element
 * when the monitor starts (as a display fades in) must move into it again.
 * The monitor also follows the player's vertical motion, so a complete rise, fall and rest
 * inside an element counts as a jump.
 */
export class PlayerMonitor {
  private readonly onEvent: (event: PlayerMonitorEvent) => void;
  /** Interactions that held on the previous frame, keyed `${elementId}:${interaction}`. */
  private held = new Set<string>();
  /** Whether a frame has been seen, so coverage on later frames can count as beginning. */
  private armed = false;
  /** Jump sequences in progress, by element id. */
  private readonly jumps = new Map<string, JumpState>();
  /** The feet position and time of the previous frame, for measuring vertical speed. */
  private previousFeet: { percentY: number; timestamp: number } | undefined;

  /** @param onEvent called for each interaction that begins */
  constructor(onEvent: (event: PlayerMonitorEvent) => void) {
    this.onEvent = onEvent;
  }

  /**
   * Updates the monitor with one frame from this player.
   *
   * @param frame the player's mask and feet for this frame
   * @param targets the elements in front of the player, by element id
   * @param timestamp when the frame was taken, in milliseconds
   */
  update(frame: PlayerFrame, targets: Record<string, MonitorTarget>, timestamp: number): void {
    const velocity = this.verticalVelocity(frame.feet, timestamp);
    const held = new Set<string>();
    const jumpIds = new Set<string>();

    for (const [elementId, target] of Object.entries(targets)) {
      const found = bodyPartsIn({ width: frame.width, height: frame.height, timestamp, people: [frame] }, target.rect);
      const coverage: TargetCoverage = {
        proportions: new Map(found.map(({ part, proportion }) => [part, proportion])),
        threshold: clampThreshold(target.threshold),
      };
      this.reportCovered(elementId, target, coverage, held);

      if (target.interactions.includes("jump")) {
        jumpIds.add(elementId);
        const footCovered = isCovered("foot", coverage);
        if (this.advanceJump(elementId, footCovered, velocity, timestamp)) {
          this.onEvent({ elementId, interaction: "jump" });
        }
      }
    }

    this.held = held;
    this.armed = true;
    for (const elementId of Array.from(this.jumps.keys())) {
      if (!jumpIds.has(elementId)) this.jumps.delete(elementId);
    }
  }

  /** Reports each coverage interaction that has just begun (once armed), and remembers those that are holding. */
  private reportCovered(elementId: string, target: MonitorTarget, coverage: TargetCoverage, held: Set<string>): void {
    for (const interaction of target.interactions) {
      if (!isCameraInteraction(interaction) || interaction === "jump") continue;
      if (!isCovered(interaction, coverage)) continue;

      const key = `${elementId}:${interaction}`;
      held.add(key);
      if (this.armed && !this.held.has(key)) this.onEvent({ elementId, interaction });
    }
  }

  /** The feet's vertical speed in frame heights per second; positive is downward. */
  private verticalVelocity(feet: FootPosition | null, timestamp: number): number | undefined {
    const previous = this.previousFeet;
    this.previousFeet = isDefined(feet) ? { percentY: feet.percent.y, timestamp } : undefined;
    if (!isDefined(feet) || !isDefined(previous)) return undefined;

    const seconds = (timestamp - previous.timestamp) / 1000;
    if (seconds <= 0) return undefined;
    return (feet.percent.y - previous.percentY) / 100 / seconds;
  }

  /** Advances one element's jump sequence, and reports whether it has just completed. */
  private advanceJump(
    elementId: string,
    footCovered: boolean,
    velocity: number | undefined,
    timestamp: number,
  ): boolean {
    const state: JumpState = this.jumps.get(elementId) ?? { phase: "ready", since: timestamp };
    if (jumpExpired(state, timestamp)) state.phase = "ready";

    let completed = false;
    if (footCovered && isDefined(velocity)) {
      const next = nextJumpPhase(state.phase, velocity);
      if (next.phase === "rising" && state.phase === "ready") state.since = timestamp;
      state.phase = next.phase;
      completed = next.completed;
    }

    this.jumps.set(elementId, state);
    return completed;
  }
}
