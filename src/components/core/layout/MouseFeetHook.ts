import { useEffect, useRef, useState, type RefObject } from "react";
import type { SceneScope } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import { lastPointer, trackPointer, type ClientPoint } from "../../../util/PointerPosition";
import { floorToViewport, viewportToFloor, type FloorView } from "../../camera/FloorGeometry";
import type { CameraInteraction } from "../../camera/PlayerMonitor";
import type { Point } from "../../../vision/VisionTypes";
import { MOUSE_FEET_INTERACTIONS } from "../logic/AvatarModeUtils";
import { FLOOR_AREA_ATTRIBUTE } from "./FloorSurfaceClasses";
import { sceneRoots } from "../logic/TemplateUtils";
import { elementKey, type CameraRuleEvent, type CameraRuleTarget } from "./PlayerInteractionHook";

/** How far, in pixels, the pointer must move with the button down before a press becomes a jump. */
export const DRAG_PX = 8;

/** The feet's footprint on screen: an ellipse about the pointer, in client pixels. */
export interface Footprint {
  /** The pointer, at the footprint's centre. */
  centre: ClientPoint;
  /** Half its width. */
  rx: number;
  /** Half its height. */
  ry: number;
  /** How far forward it stands on a 2.5D scene's floor, 0–100; none in a 2D scene. */
  depth?: number;
}

/**
 * The footprint of feet `size` floor units across at a point: on a 2.5D scene's floor, its width and depth in the
 * floor's perspective there; in a 2D scene, a circle `size`% of the viewport's width across.
 * @param viewport the viewport's client rectangle
 */
export const footprintAt = (
  centre: ClientPoint,
  viewport: Pick<DOMRect, "left" | "top" | "width" | "height">,
  view: FloorView | undefined,
  size: number,
): Footprint => {
  const { left, top, width, height } = viewport;
  if (!view || width === 0 || height === 0) return { centre, rx: (size / 200) * width, ry: (size / 200) * width };
  const floor = viewportToFloor(view, { x: (centre.x - left) / width, y: (centre.y - top) / height });
  const screen = (x: number, y: number) => floorToViewport(view, { x: floor.x + x, y: floor.y + y });
  const r = size / 2;
  const [across, along] = [
    [screen(-r, 0), screen(r, 0)],
    [screen(0, -r), screen(0, r)],
  ];
  const half = ([a, b]: Point[]) => Math.hypot((b.x - a.x) * width, (b.y - a.y) * height) / 2;
  return { centre, rx: half(across), ry: half(along), depth: floor.y };
};

/** Where across the footprint its points are, as fractions of its radii: a 5 × 5 grid, inside the ellipse. */
const FOOTPRINT_GRID = [-0.8, -0.4, 0, 0.4, 0.8].flatMap((u) =>
  [-0.8, -0.4, 0, 0.4, 0.8].flatMap((v) => (u * u + v * v <= 1 ? [{ u, v }] : [])),
);

/** The points a footprint covers, in client pixels, for what is under it to be measured. */
export const footprintPoints = ({ centre, rx, ry }: Footprint): ClientPoint[] =>
  FOOTPRINT_GRID.map(({ u, v }) => ({ x: centre.x + u * rx, y: centre.y + v * ry }));

/** The points under feet at a pointer. */
export type FootprintOf = (point: ClientPoint) => ClientPoint[];

/** The player the pointer's feet belong to. */
const MOUSE_PLAYER = 1;

/** An element a rule watches, under the pointer. */
interface FeetTarget {
  /** The rule and element, as reported. */
  source: Omit<CameraRuleEvent, "interaction" | "player">;
  /** The rule's interactions. */
  interactions: readonly CameraInteraction[];
  /** How long the feet must stay over it before they enter. */
  holdMs: number;
}

/**
 * Whether a point is on an element, and (unless covered elements count) the element is on top there. A floor area's
 * box is wider than the area drawn in perspective, so it is hit-tested, which follows its transform.
 */
const isUnder = (element: Element, { x, y }: ClientPoint, includeCovered: boolean): boolean => {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  if (x < left || x >= right || y < top || y >= bottom) return false;
  if (includeCovered) {
    return (
      !element.closest(`[${FLOOR_AREA_ATTRIBUTE}]`) ||
      document.elementsFromPoint(x, y).some((hit) => element.contains(hit))
    );
  }
  const hit = document.elementFromPoint(x, y);
  return hit !== null && element.contains(hit);
};

/** The interactions of a rule the pointer's feet can fire. */
const feetInteractions = (rule: CameraRuleTarget): CameraInteraction[] =>
  rule.interactions.filter((interaction) => MOUSE_FEET_INTERACTIONS.some((feet) => feet === interaction));

/**
 * The elements the rules watch under the feet, by the same keys the camera uses: those under at least the rule's
 * `threshold` of the footprint's points.
 * ponytail: up to 21 hit tests per target box the footprint touches, every frame; test the footprint's box against
 * each target's first if a scene with many targets shows it in profiles.
 */
const targetsAt = (rules: CameraRuleTarget[], points: ClientPoint[]): Map<string, FeetTarget> => {
  const found = new Map<string, FeetTarget>();
  for (const rule of rules) {
    const interactions = feetInteractions(rule);
    const selector = rule.selector;
    if (interactions.length === 0 || !isDefined(selector)) continue;
    for (const element of sceneRoots(rule.scope).flatMap((root) => Array.from(root.querySelectorAll(selector)))) {
      const under = points.filter((point) => isUnder(element, point, rule.includeCovered)).length;
      if (under === 0 || under < Math.min(rule.threshold, 1) * points.length) continue;
      found.set(`${rule.scope}#${rule.ruleIndex}#${elementKey(element)}`, {
        source: { scope: rule.scope, ruleIndex: rule.ruleIndex, element },
        interactions,
        holdMs: rule.holdMs,
      });
    }
  }
  return found;
};

/** The jump interactions a landing fires for a target, given whether the jump left from it and landed on it. */
const landingInteractions = (interactions: readonly CameraInteraction[], from: boolean, onto: boolean) =>
  interactions.filter(
    (interaction) =>
      (interaction === "jump" && from && onto) ||
      (interaction === "jump-from" && from) ||
      (interaction === "jump-onto" && onto),
  );

/**
 * The pointer as player 1's feet: what they are over, entering after a target's hold, and jumps by dragging.
 * Like the camera's monitor, what comes under feet that aren't moving (a scene starting or resetting, or an element
 * moving under them) enters it ({@link restand}), without the pointer having to move.
 */
export class MouseFeet {
  /** Targets the feet have entered. */
  private entered = new Map<string, FeetTarget>();
  /** Targets the feet are over, waiting out their hold, with the timer that enters them. */
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  /** Where the button went down, and the jump targets under it, while it is down. */
  private press: { at: ClientPoint; takeoff: Map<string, FeetTarget>; airborne: boolean } | undefined;

  /** The rules the feet can fire, for the scenes shown now. */
  private rules: CameraRuleTarget[] = [];
  /** Called for each interaction that begins. */
  private report: ((event: CameraRuleEvent) => void) | undefined;
  /** The points under the feet at a pointer. */
  private footprint: FootprintOf = (point) => [point];

  /**
   * Gives the feet the rules they can fire now, and what to call when they do.
   * @param rules the rules the camera (and so the feet) can fire, for the scenes shown now
   * @param report called for each interaction that begins
   * @param footprint the points under the feet at a pointer; just the pointer if not given
   */
  listen(rules: CameraRuleTarget[], report: (event: CameraRuleEvent) => void, footprint?: FootprintOf): void {
    this.rules = rules;
    this.report = report;
    this.footprint = footprint ?? ((point) => [point]);
  }

  /** The targets under the feet at a pointer. */
  private targetsAt(point: ClientPoint): Map<string, FeetTarget> {
    return targetsAt(this.rules, this.footprint(point));
  }

  /** Whether the feet are in the air, mid-jump. */
  get airborne(): boolean {
    return this.press?.airborne === true;
  }

  /** The feet are at a point, on the ground. */
  move(point: ClientPoint): void {
    if (this.press?.airborne === true) return;
    if (isDefined(this.press) && Math.hypot(point.x - this.press.at.x, point.y - this.press.at.y) > DRAG_PX) {
      this.press.airborne = true;
      this.leaveAll();
      return;
    }
    this.standOn(this.targetsAt(point));
  }

  /** The feet stand again where the pointer rests, as what is under it may have moved or rendered since. */
  restand(): void {
    const point = lastPointer();
    if (isDefined(point) && this.press?.airborne !== true) this.standOn(this.targetsAt(point));
  }

  /** The button went down: a jump may be starting. */
  down(point: ClientPoint): void {
    this.press = { at: point, takeoff: this.targetsAt(point), airborne: false };
  }

  /**
   * The button came up: lands a jump if the press became one.
   * @returns whether it was a jump, so the click that follows isn't one
   */
  up(point: ClientPoint): boolean {
    const press = this.press;
    this.press = undefined;
    if (!isDefined(press) || !press.airborne) return false;
    const landing = this.targetsAt(point);
    for (const key of new Set([...press.takeoff.keys(), ...landing.keys()])) {
      const target = (landing.get(key) ?? press.takeoff.get(key))!;
      for (const interaction of landingInteractions(target.interactions, press.takeoff.has(key), landing.has(key))) {
        this.fire(target, interaction);
      }
    }
    for (const rule of this.rules) {
      if (!isDefined(rule.selector) && rule.interactions.includes("jump")) {
        this.report?.({
          scope: rule.scope,
          ruleIndex: rule.ruleIndex,
          element: null,
          interaction: "jump",
          player: MOUSE_PLAYER,
        });
      }
    }
    this.standOn(landing);
    return true;
  }

  /** The feet left the game: exits fire for everything entered. */
  leave(): void {
    this.press = undefined;
    this.leaveAll();
  }

  /** Stops, without firing anything, as when interactions pause. */
  stop(): void {
    this.press = undefined;
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    this.entered.clear();
  }

  /** Starts afresh with a scene's targets: their exits won't fire, and what is under the feet enters them again. */
  rearm(scope: SceneScope): void {
    const prefix = `${scope}#`;
    for (const key of this.entered.keys()) if (key.startsWith(prefix)) this.entered.delete(key);
    for (const [key, timer] of this.pending) {
      if (!key.startsWith(prefix)) continue;
      clearTimeout(timer);
      this.pending.delete(key);
    }
  }

  /** The feet stand on these targets now: entering new ones (after their hold) and leaving the rest. */
  private standOn(under: Map<string, FeetTarget>): void {
    this.forgetAllBut(under);
    for (const [key, target] of under) {
      if (this.entered.has(key) || this.pending.has(key)) continue;
      if (target.holdMs > 0)
        this.pending.set(
          key,
          setTimeout(() => this.enter(key, target), target.holdMs),
        );
      else this.enter(key, target);
    }
  }

  /** Leaves the targets the feet are no longer on, and stops waiting on their holds. */
  private forgetAllBut(under: Map<string, FeetTarget>): void {
    for (const [key, target] of this.entered) if (!under.has(key)) this.exit(key, target);
    for (const [key, timer] of this.pending) {
      if (under.has(key)) continue;
      clearTimeout(timer);
      this.pending.delete(key);
    }
  }

  /** Leaves everything, as when the feet leave the ground or the game. */
  private leaveAll(): void {
    for (const [key, target] of this.entered) this.exit(key, target);
    this.pending.forEach(clearTimeout);
    this.pending.clear();
  }

  private enter(key: string, target: FeetTarget): void {
    this.pending.delete(key);
    this.entered.set(key, target);
    for (const interaction of ["foot-enter", "any-enter"] as const) this.fire(target, interaction);
  }

  private exit(key: string, target: FeetTarget): void {
    this.entered.delete(key);
    for (const interaction of ["foot-exit", "any-exit"] as const) this.fire(target, interaction);
  }

  /** Reports an interaction with a target, if its rule listens for it. */
  private fire(target: FeetTarget, interaction: CameraInteraction): void {
    if (target.interactions.includes(interaction))
      this.report?.({ ...target.source, interaction, player: MOUSE_PLAYER });
  }
}

/** Stops the click a browser fires after a drag, which would otherwise count as a click where the jump landed. */
const swallowNextClick = (): void => {
  const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  // No click follows when the press and release were over different elements with no shared ancestor that listens
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
};

/** Where the pointer's feet are, in client pixels, and whether they are in the air, mid-jump. */
export interface FeetAt {
  /** The pointer. */
  point: ClientPoint;
  /** Whether a drag has made the press a jump. */
  airborne: boolean;
}

/**
 * The viewport's pointer listeners that drive the feet: moving, pressing, releasing and leaving.
 * @param onFeet hears where the feet are as the pointer moves, and null as they leave
 */
const pointerListeners = (
  feet: MouseFeet,
  onFeet: ((at: FeetAt | null) => void) | undefined,
): [string, (event: PointerEvent) => void][] => {
  const at = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
  const report = (event: PointerEvent) => onFeet?.({ point: at(event), airborne: feet.airborne });
  const leave = () => {
    feet.leave();
    onFeet?.(null);
  };
  return [
    [
      "pointermove",
      (event) => {
        feet.move(at(event));
        report(event);
      },
    ],
    ["pointerdown", (event) => event.button === 0 && feet.down(at(event))],
    [
      "pointerup",
      (event) => {
        if (feet.up(at(event))) swallowNextClick();
        report(event);
      },
    ],
    ["pointerleave", leave],
    ["pointercancel", leave],
  ];
};

/**
 * Feeds pointer events on the viewport to a {@link MouseFeet} while `mouse-feet` mode is on, so the pointer fires the
 * rules' foot and jump interactions as player 1.
 *
 * @param viewportRef the game viewport
 * @param cameraRules the rules the camera (and so the feet) can fire, for the scenes shown now
 * @param onPlayerInteraction called for each interaction that begins
 * @param when whether the feet are on (`mouse-feet` mode), and whether they wait, as during a scene change; switching
 * off or pausing forgets everything without firing exits. `onFeet` hears where the feet are as the pointer moves,
 * and null as they leave the viewport; keep it stable. `footprint` gives the points under the feet at a pointer.
 */
export function useMouseFeet(
  viewportRef: RefObject<HTMLElement | null>,
  cameraRules: CameraRuleTarget[] | undefined,
  onPlayerInteraction: ((event: CameraRuleEvent) => void) | undefined,
  when: { enabled: boolean; paused?: boolean; onFeet?: (at: FeetAt | null) => void; footprint?: FootprintOf },
): void {
  const { enabled, paused = false, onFeet, footprint } = when;
  const [feet] = useState(() => new MouseFeet());
  const runsRef = useRef(new Map<SceneScope, number>());

  useEffect(() => {
    feet.listen(cameraRules ?? [], (event) => onPlayerInteraction?.(event), footprint);
    const runs = new Map((cameraRules ?? []).map(({ scope, run }) => [scope, run]));
    for (const [scope, run] of runs) {
      const before = runsRef.current.get(scope);
      if (isDefined(before) && before !== run) feet.rearm(scope);
    }
    runsRef.current = runs;
  }, [cameraRules, onPlayerInteraction, feet, footprint]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || paused || !viewport) return;
    const listeners = pointerListeners(feet, onFeet);
    const preventDefault = (event: Event) => event.preventDefault();
    listeners.forEach(([type, listener]) => viewport.addEventListener(type, listener as EventListener));
    // A drag is a jump, not a dragged image or a text selection
    viewport.addEventListener("dragstart", preventDefault);
    viewport.addEventListener("selectstart", preventDefault);
    // Stands where the pointer rests as the feet start, or start again after a pause, and again each frame, as
    // elements move under it and scenes render beneath it
    trackPointer();
    feet.restand();
    let frame = requestAnimationFrame(function restandEachFrame() {
      feet.restand();
      frame = requestAnimationFrame(restandEachFrame);
    });
    return () => {
      cancelAnimationFrame(frame);
      listeners.forEach(([type, listener]) => viewport.removeEventListener(type, listener as EventListener));
      viewport.removeEventListener("dragstart", preventDefault);
      viewport.removeEventListener("selectstart", preventDefault);
      feet.stop();
    };
  }, [enabled, paused, viewportRef, feet, onFeet]);
}
