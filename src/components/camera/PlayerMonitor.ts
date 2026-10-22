import type { GameInteraction } from "../../entities/data/displays/GameDisplayData";
import { isDefined } from "../../util/ObjectUtils";
import { BODY_PARTS } from "./BodySegSupport";
import type { FootPosition, MaskRect } from "./CameraSupport";

/** Interactions the player monitor can detect through the camera. */
export type CameraInteraction = Exclude<GameInteraction, "click">;

/** One player, as the camera saw them in a frame. */
export interface PlayerFrame {
  /** The player's index in the segmentation. */
  id: number;
  /** The player's body-part mask: the red channel holds the part, the alpha channel the body. */
  mask: Pick<ImageData, "data" | "width" | "height">;
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
  interactions: string[];
  /** Fraction of the body part that must be inside the element (0–1). */
  threshold: number;
}

/** Interactions detected from how much of a body part is inside an element. */
type CoverageInteraction = Exclude<CameraInteraction, "jump">;

/** Mask values counted for each grouped interaction. */
const PART_GROUPS: Record<Exclude<CoverageInteraction, "body" | "any">, number[]> = {
  hand: [BODY_PARTS.LEFT_HAND.maskValue, BODY_PARTS.RIGHT_HAND.maskValue],
  foot: [BODY_PARTS.LEFT_FOOT.maskValue, BODY_PARTS.RIGHT_FOOT.maskValue],
  head: [BODY_PARTS.LEFT_FACE.maskValue, BODY_PARTS.RIGHT_FACE.maskValue],
};

/** Every mask value the segmentation model uses for a body part. */
const BODY_PART_VALUES = Object.values(BODY_PARTS).map((part) => part.maskValue);

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
  /** The frame's counts per body part. */
  totals: Uint32Array;
  /** The frame's counts per body part inside the target. */
  inside: Uint32Array;
  /** The target's threshold, clamped to the range it means. */
  threshold: number;
}

/** Whether a value is an interaction the monitor understands, including unknown values from game data. */
const isCameraInteraction = (value: string): value is CameraInteraction =>
  value === "hand" || value === "foot" || value === "head" || value === "body" || value === "any" || value === "jump";

/** Clamps an authored threshold to the range it means. */
const clampThreshold = (threshold: number): number => Math.min(Math.max(threshold, 0), 1);

/** Counts the frame's opaque pixels per mask value. */
const countParts = (mask: PlayerFrame["mask"]): Uint32Array => {
  const counts = new Uint32Array(256);
  const { data } = mask;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) counts[data[i]]++;
  }
  return counts;
};

/** Counts the opaque pixels per mask value inside the given rectangle. */
const countPartsInside = (mask: PlayerFrame["mask"], rect: MaskRect): Uint32Array => {
  const counts = new Uint32Array(256);
  const { data, width, height } = mask;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(width, rect.right);
  const bottom = Math.min(height, rect.bottom);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 0) counts[data[i]]++;
    }
  }
  return counts;
};

/** Sums the counts for the given mask values. */
const sumValues = (counts: Uint32Array, values: number[]): number => {
  let total = 0;
  for (const value of values) total += counts[value];
  return total;
};

/** Sums every count, which is the whole person silhouette. */
const sumAll = (counts: Uint32Array): number => {
  let total = 0;
  for (const count of counts) total += count;
  return total;
};

/** Whether enough of a body part is inside the element: some of it, and at least the threshold's fraction. */
const covers = (inside: number, total: number, threshold: number): boolean => inside > 0 && inside / total >= threshold;

/** Whether the interaction's body part meets the threshold inside the element. */
const isCovered = (
  interaction: CoverageInteraction,
  inside: Uint32Array,
  totals: Uint32Array,
  threshold: number,
): boolean => {
  if (interaction === "body") return covers(sumAll(inside), sumAll(totals), threshold);
  if (interaction === "any") return BODY_PART_VALUES.some((value) => covers(inside[value], totals[value], threshold));
  const values = PART_GROUPS[interaction];
  return covers(sumValues(inside, values), sumValues(totals, values), threshold);
};

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
 * The monitor also follows the player's vertical motion, so a complete rise, fall and rest
 * inside an element counts as a jump.
 */
export class PlayerMonitor {
  private readonly onEvent: (event: PlayerMonitorEvent) => void;
  /** Interactions that held on the previous frame, keyed `${elementId}:${interaction}`. */
  private held = new Set<string>();
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
    const totals = countParts(frame.mask);
    const velocity = this.verticalVelocity(frame.feet, timestamp);
    const held = new Set<string>();
    const jumpIds = new Set<string>();

    for (const [elementId, target] of Object.entries(targets)) {
      const coverage: TargetCoverage = {
        totals,
        inside: countPartsInside(frame.mask, target.rect),
        threshold: clampThreshold(target.threshold),
      };
      this.reportCovered(elementId, target, coverage, held);

      if (target.interactions.includes("jump")) {
        jumpIds.add(elementId);
        const footCovered = isCovered("foot", coverage.inside, totals, coverage.threshold);
        if (this.advanceJump(elementId, footCovered, velocity, timestamp)) {
          this.onEvent({ elementId, interaction: "jump" });
        }
      }
    }

    this.held = held;
    for (const elementId of Array.from(this.jumps.keys())) {
      if (!jumpIds.has(elementId)) this.jumps.delete(elementId);
    }
  }

  /** Reports each coverage interaction that has just begun, and remembers those that are holding. */
  private reportCovered(elementId: string, target: MonitorTarget, coverage: TargetCoverage, held: Set<string>): void {
    for (const interaction of target.interactions) {
      if (!isCameraInteraction(interaction) || interaction === "jump") continue;
      if (!isCovered(interaction, coverage.inside, coverage.totals, coverage.threshold)) continue;

      const key = `${elementId}:${interaction}`;
      held.add(key);
      if (!this.held.has(key)) this.onEvent({ elementId, interaction });
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
