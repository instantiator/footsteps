import type { GameInteraction, PointerInteraction } from "../../entities/data/scenes/GameSceneData";
import { DEFAULT_APP_CONFIG } from "../../config/AppConfig";
import { isDefined } from "../../util/ObjectUtils";
import { BODY_PARTS, BodyPart } from "../../vision/BodyPart";
import { bodyPartsIn, partRegion, isSilhouetteWithin } from "../../vision/VisionQueries";
import type { Point, VisionPerson } from "../../vision/VisionTypes";
import type { FootPosition } from "./CameraSupport";
import type { MaskRect } from "./FloorGeometry";
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

/** What being near an element means, in mask pixels. */
export interface NearTarget {
  /** The element's centre, which may be outside the mask. */
  centre: Point;
  /** How close counts. */
  within: number;
}

/** An element the player can interact with, and where it is in the mask. */
export interface MonitorTarget {
  /** The element's bounds in mask pixels. */
  rect: MaskRect;
  /** The interactions the element accepts; unknown values are ignored when the monitor runs. */
  interactions: readonly string[];
  /** Fraction of the body part that must be inside the element (0–1). */
  threshold: number;
  /** How long, in milliseconds, a body part must stay over the element before it enters; 0 by default. */
  holdMs?: number;
  /**
   * Whether the element is the topmost thing at a point in the mask, as a click there would find it. Without it,
   * the element counts wherever it is, even under others.
   */
  isTopmostAt?: (point: Point) => boolean;
  /** For being near the element. */
  near?: NearTarget;
  /** For a jump with no element: it fires on every landing. */
  anywhere?: boolean;
}

/** The interactions that come from a jump, all reported as the player lands. */
const JUMP_INTERACTIONS = ["jump", "jump-from", "jump-onto"] as const;

/** An interaction that comes from a jump. */
type JumpInteraction = (typeof JUMP_INTERACTIONS)[number];

/** Interactions detected from how close a player's silhouette is to an element. */
type NearInteraction = "near-enter" | "near-exit";

/** Interactions detected from how much of a body part is inside an element. */
type CoverageInteraction = Exclude<CameraInteraction, JumpInteraction | NearInteraction>;

/** What a coverage interaction looks for: a group of body parts. */
type PartGroup = "hand" | "foot" | "head" | "body" | "any";

/** What is followed over a target from frame to frame: a group of body parts, or the player being near it. */
type PresenceGroup = PartGroup | "near";

/** The body parts in each group; any one of them over the element counts. */
const PART_GROUPS: Record<PartGroup, readonly BodyPart[]> = {
  hand: [BodyPart.LEFT_HAND, BodyPart.RIGHT_HAND],
  foot: [BodyPart.LEFT_FOOT, BodyPart.RIGHT_FOOT],
  head: [BodyPart.HEAD],
  body: [BodyPart.BODY],
  any: BODY_PARTS,
};

/** The group each coverage interaction looks for. */
const COVERAGE_GROUPS: Record<CoverageInteraction, PartGroup> = {
  "hand-enter": "hand",
  "foot-enter": "foot",
  "head-enter": "head",
  "body-enter": "body",
  "any-enter": "any",
  "hand-exit": "hand",
  "foot-exit": "foot",
  "head-exit": "head",
  "body-exit": "body",
  "any-exit": "any",
};

/** The groups a target's coverage interactions look for, each once. */
const groupsOf = (interactions: readonly string[]): Set<PartGroup> =>
  new Set(interactions.filter(isCoverageInteraction).map((interaction) => COVERAGE_GROUPS[interaction]));

/** A group of body parts over a target in a frame. */
interface Arrival {
  /** The target's key. */
  targetKey: string;
  /** The target. */
  target: MonitorTarget;
  /** The group of body parts, or the player being near. */
  group: PresenceGroup;
  /** When the frame was taken, in milliseconds. */
  timestamp: number;
}

/** One group of body parts over one target, as followed from frame to frame. */
interface Presence {
  /** The target's key. */
  key: string;
  /** The group of body parts, or the player being near. */
  group: PresenceGroup;
  /** Frames in a row the group has been over the target; {@link ALREADY_HELD} if it was over when the monitor was armed. */
  streak: number;
  /** When the streak began, in milliseconds, for the target's {@link MonitorTarget.holdMs}. */
  since: number;
  /** Whether it stayed over the target long enough to have entered it, so it can leave. */
  entered: boolean;
  /** Frames in a row an entered group has been away. */
  away: number;
}

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
const isCoverageInteraction = (value: string): value is CoverageInteraction => Object.hasOwn(COVERAGE_GROUPS, value);

/** Whether an interaction needs to know how much of each body part is over a target. */
const usesCoverage = (interaction: string): boolean =>
  isCoverageInteraction(interaction) || isJumpInteraction(interaction);

/** Clamps an authored threshold to the range it means. */
const clampThreshold = (threshold: number): number => Math.min(Math.max(threshold, 0), 1);

/** Whether enough of any of the interaction's body parts is inside the element, where nothing covers it. */
const isCovered = (group: PartGroup, { proportions, threshold, visible }: TargetCoverage): boolean =>
  PART_GROUPS[group].some((part) => {
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

/** One frame's reading of a player and a target they may be near. */
interface NearReading {
  /** The target's key. */
  key: string;
  /** The target. */
  target: MonitorTarget;
  /** What being near it means. */
  near: NearTarget;
  /** The player's frame. */
  frame: PlayerFrame;
  /** When the frame was taken, in milliseconds. */
  timestamp: number;
}

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
 * when the monitor starts (as a scene fades in) must move into it again.
 * The monitor also follows the player's feet for jumps ({@link JumpDetector}). When they land, it fires `jump` for an
 * element their feet were on both at take-off and at landing, `jump-from` for one they took off from, and
 * `jump-onto` for one they landed on.
 */
export class PlayerMonitor {
  private readonly onEvent: (event: PlayerMonitorEvent) => void;
  /** Frames an interaction must hold before it fires. */
  private readonly stableFrames: number;
  /** Each group of body parts over each target, keyed `${key}:${group}`, while it is over or has entered. */
  private presence = new Map<string, Presence>();
  /** The targets of the latest frame, to know which exits a released player fires. */
  private targets: Record<string, MonitorTarget> = {};
  /** Whether a frame has been seen, so coverage on later frames can count as beginning. */
  private armed = false;
  /** The starts of target keys to treat as new in the next frame, as on the monitor's first; see {@link rearm}. */
  private rearming: string[] = [];
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
    const presence = new Map<string, Presence>();
    const feetOn = new Set<string>();

    for (const [key, target] of Object.entries(targets)) {
      if (isDefined(target.near)) this.reportNear({ key, target, near: target.near, frame, timestamp }, presence);
      if (target.anywhere === true || !target.interactions.some(usesCoverage)) continue;
      const found = bodyPartsIn({ width: frame.width, height: frame.height, timestamp, people: [frame] }, target.rect);
      const coverage = {
        proportions: new Map(found.map(({ part, proportion }) => [part, proportion])),
        threshold: clampThreshold(target.threshold),
        visible: visibility(frame, target),
        timestamp,
      };
      this.reportCoverage(key, target, coverage, presence);
      if (target.interactions.some(isJumpInteraction) && isCovered("foot", coverage)) feetOn.add(key);
    }

    this.presence = presence;
    this.targets = targets;
    this.armed = true;
    this.rearming = [];
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
      for (const [key, { interactions, anywhere }] of Object.entries(targets)) {
        const [from, onto] = anywhere === true ? [true, true] : [this.takeoffKeys.has(key), feetOn.has(key)];
        for (const interaction of landingInteractions(interactions, from, onto)) {
          this.onEvent({ key, interaction });
        }
      }
    }
    if (!this.jump.airborne) this.takeoffKeys = feetOn;
  }

  /**
   * Reports the player as gone: fires the exits of everything they had entered, as if they left it, and forgets it.
   * (Not for interactions pausing, when nothing has been left.)
   */
  release(): void {
    for (const { key, group, entered } of this.presence.values()) {
      if (entered) this.report(key, `${group}-exit`, this.targets[key]);
    }
    this.presence.clear();
  }

  /**
   * Starts afresh with some targets, without firing anything: their exits won't fire, and what is over them must move
   * into them again.
   * @param keyPrefix how the keys of those targets begin
   */
  rearm(keyPrefix: string): void {
    for (const [presenceKey, { key }] of this.presence) {
      if (key.startsWith(keyPrefix)) this.presence.delete(presenceKey);
    }
    this.rearming.push(keyPrefix);
  }

  /** Follows the player being near a target, in the same way as a group of body parts over it. */
  private reportNear({ key, target, near, frame, timestamp }: NearReading, presence: Map<string, Presence>): void {
    const presenceKey = `${key}:near`;
    const before = this.presence.get(presenceKey);
    const now = isSilhouetteWithin(frame, frame, near.centre, near.within)
      ? this.stay(before, { targetKey: key, target, group: "near", timestamp })
      : this.leave(before);
    if (isDefined(now)) presence.set(presenceKey, now);
    const [wasIn, isIn] = [before?.entered === true, now?.entered === true];
    if (wasIn !== isIn) this.report(key, isIn ? "near-enter" : "near-exit", target);
  }

  /** Follows each group of body parts the target looks for over it, and reports it entering and leaving. */
  private reportCoverage(
    targetKey: string,
    target: MonitorTarget,
    coverage: TargetCoverage & { timestamp: number },
    presence: Map<string, Presence>,
  ): void {
    const { timestamp } = coverage;
    for (const group of groupsOf(target.interactions)) {
      const presenceKey = `${targetKey}:${group}`;
      const before = this.presence.get(presenceKey);
      const now = isCovered(group, coverage)
        ? this.stay(before, { targetKey, target, group, timestamp })
        : this.leave(before);
      if (isDefined(now)) presence.set(presenceKey, now);
      const [wasIn, isIn] = [before?.entered === true, now?.entered === true];
      if (wasIn !== isIn) this.report(targetKey, `${group}-${isIn ? "enter" : "exit"}`, target);
    }
  }

  /**
   * A group over the target this frame: its streak grows, and it enters once the streak has lasted the stable frames
   * and the target's hold.
   */
  private stay(before: Presence | undefined, { targetKey, target, group, timestamp }: Arrival): Presence {
    const streak =
      this.isStarting(targetKey) || before?.streak === ALREADY_HELD ? ALREADY_HELD : (before?.streak ?? 0) + 1;
    const since = before?.since ?? timestamp;
    const entered = before?.entered === true || this.hasHeld(streak, timestamp - since, target);
    return { key: targetKey, group, streak, since, entered, away: 0 };
  }

  /** Whether this frame is the first the monitor has seen of a target, so what is over it already held. */
  private isStarting(targetKey: string): boolean {
    return !this.armed || this.rearming.some((prefix) => targetKey.startsWith(prefix));
  }

  /** Whether a streak (not one held when the monitor was armed) has lasted the stable frames and the target's hold. */
  private hasHeld(streak: number, heldMs: number, target: MonitorTarget): boolean {
    return streak !== ALREADY_HELD && streak >= this.stableFrames && heldMs >= (target.holdMs ?? 0);
  }

  /** A group away from the target this frame: forgotten unless it entered, which leaves once it has been away long enough. */
  private leave(before: Presence | undefined): Presence | undefined {
    if (before?.entered !== true || before.away + 1 >= this.stableFrames) return undefined;
    return { ...before, away: before.away + 1 };
  }

  /** Reports an interaction with a target, if the target accepts it. */
  private report(
    key: string,
    interaction: CoverageInteraction | NearInteraction,
    target: MonitorTarget | undefined,
  ): void {
    if (target?.interactions.includes(interaction) === true) this.onEvent({ key, interaction });
  }
}
