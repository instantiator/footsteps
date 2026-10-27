import type { GameInteraction, PointerInteraction } from "../../entities/data/displays/GameDisplayData";
import { DEFAULT_APP_CONFIG } from "../../config/AppConfig";
import { isDefined } from "../../util/ObjectUtils";
import { BODY_PARTS, BodyPart } from "../../vision/BodyPart";
import { bodyPartsIn, partRegion } from "../../vision/VisionQueries";
import type { Point, VisionPerson } from "../../vision/VisionTypes";
import type { FootPosition, MaskRect } from "./CameraSupport";
import { JumpDetector, jumpSettingsOf, type JumpSettings } from "./JumpDetector";

/** Interactions the player monitor can detect through the camera. */
export type CameraInteraction = Exclude<GameInteraction, PointerInteraction>;

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
  /** The key of the target the player interacted with. */
  key: string;
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
  /**
   * Whether the element is the topmost thing at a point in the mask, as a click there would find it. Without it,
   * the element counts wherever it is, even under others.
   */
  isTopmostAt?: (point: Point) => boolean;
}

/** The interactions that come from a jump, all reported as the player lands. */
const JUMP_INTERACTIONS = ["jump", "jump-from", "jump-onto"] as const;

/** An interaction that comes from a jump. */
type JumpInteraction = (typeof JUMP_INTERACTIONS)[number];

/** Interactions detected from how much of a body part is inside an element. */
type CoverageInteraction = Exclude<CameraInteraction, JumpInteraction>;

/** The body parts each coverage interaction looks for; any one of them over the element counts. */
const PART_GROUPS: Record<CoverageInteraction, readonly BodyPart[]> = {
  hand: [BodyPart.LEFT_HAND, BodyPart.RIGHT_HAND],
  foot: [BodyPart.LEFT_FOOT, BodyPart.RIGHT_FOOT],
  head: [BodyPart.HEAD],
  body: [BodyPart.BODY],
  any: BODY_PARTS,
};

/** What one frame means for a target's coverage. */
interface TargetCoverage {
  /** The fraction of each body part that is inside the target; parts with none inside are absent. */
  proportions: Map<BodyPart, number>;
  /** The target's threshold, clamped to the range it means. */
  threshold: number;
  /** Whether the target is on top where the part is, so nothing covers it there. */
  visible: (part: BodyPart) => boolean;
}

/** Whether a value is an interaction that comes from a jump. */
const isJumpInteraction = (value: string): value is JumpInteraction => JUMP_INTERACTIONS.some((jump) => jump === value);

/** Whether a value is an interaction detected from coverage, rather than unknown game data or a jump. */
const isCoverageInteraction = (value: string): value is CoverageInteraction => Object.hasOwn(PART_GROUPS, value);

/** Clamps an authored threshold to the range it means. */
const clampThreshold = (threshold: number): number => Math.min(Math.max(threshold, 0), 1);

/** Whether enough of any of the interaction's body parts is inside the element, where nothing covers it. */
const isCovered = (interaction: CoverageInteraction, { proportions, threshold, visible }: TargetCoverage): boolean =>
  PART_GROUPS[interaction].some((part) => {
    const proportion = proportions.get(part);
    return proportion !== undefined && proportion >= threshold && visible(part);
  });

/** The centre of where two rectangles overlap, or undefined if they don't. */
const overlapCentre = (a: MaskRect, b: MaskRect): Point | undefined => {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : undefined;
};

/**
 * Whether a target is on top where a part overlaps it, sampled once per part (and frame), at the centre of the
 * part's region clipped to the target.
 * ponytail: one sample per part; sample a grid if partly covered elements fire, or fail to, when they shouldn't.
 */
const visibility = (frame: PlayerFrame, { isTopmostAt, rect }: MonitorTarget): ((part: BodyPart) => boolean) => {
  if (!isTopmostAt) return () => true;
  const seen = new Map<BodyPart, boolean>();
  return (part) => {
    if (!seen.has(part)) {
      const bounds = partRegion(frame, part, frame.width, frame.height)?.bounds;
      const centre = isDefined(bounds) ? overlapCentre(bounds, rect) : undefined;
      seen.set(part, isDefined(centre) && isTopmostAt(centre));
    }
    return seen.get(part)!;
  };
};

/** Marks an interaction that already held when the monitor was armed: it can't fire until it lets go. */
const ALREADY_HELD = -1;

/** The jump interactions an element accepts that a landing fires, given whether the jump left from it and landed on it. */
const landingInteractions = (interactions: readonly string[], from: boolean, onto: boolean): JumpInteraction[] => {
  const happened: Record<JumpInteraction, boolean> = { jump: from && onto, "jump-from": from, "jump-onto": onto };
  return JUMP_INTERACTIONS.filter((jump) => happened[jump] && interactions.includes(jump));
};

/**
 * The player's height in mask pixels, which jumps are measured against: from their feet to the top of their head, or
 * half the frame when the model hasn't placed both.
 */
const bodyHeightOf = ({ feet, keyPoints, height }: PlayerFrame): number => {
  const measured = isDefined(feet) && isDefined(keyPoints.headTop) ? feet.absolute.y - keyPoints.headTop.y : 0;
  return measured > 0 ? measured : height / 2;
};

/**
 * Turns one player's segmentation frames into interaction events.
 *
 * Events are edge-triggered: an interaction fires when it begins, not on every frame it holds.
 * The first frame only records what already holds, so a player who is already inside an element
 * when the monitor starts (as a display fades in) must move into it again.
 * The monitor also follows the player's feet for jumps ({@link JumpDetector}). When they land, it fires `jump` for an
 * element their feet were on both at take-off and at landing, `jump-from` for one they took off from, and
 * `jump-onto` for one they landed on.
 */
export class PlayerMonitor {
  private readonly onEvent: (event: PlayerMonitorEvent) => void;
  /** Frames an interaction must hold before it fires. */
  private readonly stableFrames: number;
  /**
   * How many frames in a row each interaction has held, keyed `${key}:${interaction}`;
   * {@link ALREADY_HELD} for one that held before the monitor was armed.
   */
  private held = new Map<string, number>();
  /** Whether a frame has been seen, so coverage on later frames can count as beginning. */
  private armed = false;
  private readonly jump: JumpDetector;
  /** The keys of the jump targets the feet were on when last on the ground, ie. where a jump takes off from. */
  private takeoffKeys = new Set<string>();

  /**
   * @param onEvent called for each interaction that begins
   * @param stableFrames frames an interaction must hold before it fires, so a one-frame flicker doesn't count
   * @param jump what counts as a jump
   */
  constructor(
    onEvent: (event: PlayerMonitorEvent) => void,
    stableFrames = 1,
    jump: JumpSettings = jumpSettingsOf(DEFAULT_APP_CONFIG),
  ) {
    this.onEvent = onEvent;
    this.stableFrames = Math.max(1, stableFrames);
    this.jump = new JumpDetector(jump);
  }

  /**
   * Updates the monitor with one frame from this player.
   *
   * @param frame the player's mask and feet for this frame
   * @param targets the elements in front of the player, by a key that stays the same for an element across frames
   * @param timestamp when the frame was taken, in milliseconds
   */
  update(frame: PlayerFrame, targets: Record<string, MonitorTarget>, timestamp: number): void {
    const held = new Map<string, number>();
    const feetOn = new Set<string>();

    for (const [key, target] of Object.entries(targets)) {
      const found = bodyPartsIn({ width: frame.width, height: frame.height, timestamp, people: [frame] }, target.rect);
      const coverage: TargetCoverage = {
        proportions: new Map(found.map(({ part, proportion }) => [part, proportion])),
        threshold: clampThreshold(target.threshold),
        visible: visibility(frame, target),
      };
      this.reportCovered(key, target, coverage, held);
      if (target.interactions.some(isJumpInteraction) && isCovered("foot", coverage)) feetOn.add(key);
    }

    this.held = held;
    this.armed = true;
    this.followJump(frame, targets, feetOn, timestamp);
  }

  /** Follows the feet for jumps, and on landing reports the jump interactions of where they took off and landed. */
  private followJump(
    frame: PlayerFrame,
    targets: Record<string, MonitorTarget>,
    feetOn: Set<string>,
    timestamp: number,
  ): void {
    const landed = this.jump.update(frame.feet?.absolute.y ?? null, bodyHeightOf(frame), timestamp) === "landed";
    if (landed) {
      for (const [key, { interactions }] of Object.entries(targets)) {
        for (const interaction of landingInteractions(interactions, this.takeoffKeys.has(key), feetOn.has(key))) {
          this.onEvent({ key, interaction });
        }
      }
    }
    if (!this.jump.airborne) this.takeoffKeys = feetOn;
  }

  /** Reports each coverage interaction that has held for long enough (once armed), and counts those that are holding. */
  private reportCovered(
    targetKey: string,
    target: MonitorTarget,
    coverage: TargetCoverage,
    held: Map<string, number>,
  ): void {
    for (const interaction of target.interactions) {
      if (!isCoverageInteraction(interaction)) continue;
      if (!isCovered(interaction, coverage)) continue;

      const heldKey = `${targetKey}:${interaction}`;
      const previous = this.held.get(heldKey) ?? 0;
      const streak = !this.armed || previous === ALREADY_HELD ? ALREADY_HELD : previous + 1;
      held.set(heldKey, streak);
      if (streak === this.stableFrames) this.onEvent({ key: targetKey, interaction });
    }
  }
}
