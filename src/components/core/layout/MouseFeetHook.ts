import { useEffect, useRef, useState, type RefObject } from "react";
import type { SceneScope } from "../../../entities/state/GameState";
import { isDefined } from "../../../util/ObjectUtils";
import type { CameraInteraction } from "../../camera/PlayerMonitor";
import { MOUSE_FEET_INTERACTIONS } from "../logic/AvatarModeUtils";
import { sceneRoots } from "../logic/TemplateUtils";
import { elementKey, type CameraRuleEvent, type CameraRuleTarget } from "./PlayerInteractionHook";

/** How far, in pixels, the pointer must move with the button down before a press becomes a jump. */
export const DRAG_PX = 8;

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

/** A point on the screen. */
interface ClientPoint {
  x: number;
  y: number;
}

/** Whether a point is inside an element's box, and (unless covered elements count) the element is on top there. */
const isUnder = (element: Element, { x, y }: ClientPoint, includeCovered: boolean): boolean => {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  if (x < left || x >= right || y < top || y >= bottom) return false;
  if (includeCovered) return true;
  const hit = document.elementFromPoint(x, y);
  return hit !== null && element.contains(hit);
};

/** The interactions of a rule the pointer's feet can fire. */
const feetInteractions = (rule: CameraRuleTarget): CameraInteraction[] =>
  rule.interactions.filter((interaction) => MOUSE_FEET_INTERACTIONS.some((feet) => feet === interaction));

/**
 * The elements the rules watch under the point, by the same keys the camera uses.
 * ponytail: the feet are a point, so thresholds don't apply; give them an area if authors' thresholds need to matter.
 */
const targetsAt = (rules: CameraRuleTarget[], point: ClientPoint): Map<string, FeetTarget> => {
  const found = new Map<string, FeetTarget>();
  for (const rule of rules) {
    const interactions = feetInteractions(rule);
    const selector = rule.selector;
    if (interactions.length === 0 || !isDefined(selector)) continue;
    for (const element of sceneRoots(rule.scope).flatMap((root) => Array.from(root.querySelectorAll(selector)))) {
      if (!isUnder(element, point, rule.includeCovered)) continue;
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
 * Like the camera's monitor, what is already under the feet when it starts, or when a scene resets, must be left
 * and entered again before it fires.
 */
export class MouseFeet {
  /** Targets the feet have entered. */
  private entered = new Map<string, FeetTarget>();
  /** Targets the feet are over, waiting out their hold, with the timer that enters them. */
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  /** Targets the feet were already over when they started, which can't fire until left. */
  private held = new Set<string>();
  /** Whether a position has been seen since starting. */
  private armed = false;
  /** The starts of target keys to treat as already held at the next position; see {@link rearm}. */
  private rearming: string[] = [];
  /** Where the button went down, and the jump targets under it, while it is down. */
  private press: { at: ClientPoint; takeoff: Map<string, FeetTarget>; airborne: boolean } | undefined;

  /** The rules the feet can fire, for the scenes shown now. */
  private rules: CameraRuleTarget[] = [];
  /** Called for each interaction that begins. */
  private report: ((event: CameraRuleEvent) => void) | undefined;

  /**
   * Gives the feet the rules they can fire now, and what to call when they do.
   * @param rules the rules the camera (and so the feet) can fire, for the scenes shown now
   * @param report called for each interaction that begins
   */
  listen(rules: CameraRuleTarget[], report: (event: CameraRuleEvent) => void): void {
    this.rules = rules;
    this.report = report;
  }

  /** The feet are at a point, on the ground. */
  move(point: ClientPoint): void {
    if (this.press?.airborne === true) return;
    if (isDefined(this.press) && Math.hypot(point.x - this.press.at.x, point.y - this.press.at.y) > DRAG_PX) {
      this.press.airborne = true;
      this.leaveAll();
      return;
    }
    this.standOn(targetsAt(this.rules, point));
  }

  /** The button went down: a jump may be starting. */
  down(point: ClientPoint): void {
    this.press = { at: point, takeoff: targetsAt(this.rules, point), airborne: false };
  }

  /**
   * The button came up: lands a jump if the press became one.
   * @returns whether it was a jump, so the click that follows isn't one
   */
  up(point: ClientPoint): boolean {
    const press = this.press;
    this.press = undefined;
    if (!isDefined(press) || !press.airborne) return false;
    const landing = targetsAt(this.rules, point);
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

  /** The feet left the game: exits fire for everything entered, and the next position starts afresh. */
  leave(): void {
    this.press = undefined;
    this.leaveAll();
    this.armed = false;
  }

  /** Stops, without firing anything, as when interactions pause. */
  stop(): void {
    this.press = undefined;
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    this.entered.clear();
    this.held.clear();
    this.armed = false;
  }

  /** Starts afresh with a scene's targets: their exits won't fire, and what is under the feet must be entered again. */
  rearm(scope: SceneScope): void {
    const prefix = `${scope}#`;
    for (const key of this.entered.keys()) if (key.startsWith(prefix)) this.entered.delete(key);
    for (const [key, timer] of this.pending) {
      if (!key.startsWith(prefix)) continue;
      clearTimeout(timer);
      this.pending.delete(key);
    }
    this.rearming.push(prefix);
  }

  /** The feet stand on these targets now: entering new ones (after their hold) and leaving the rest. */
  private standOn(under: Map<string, FeetTarget>): void {
    this.forgetAllBut(under);
    for (const [key, target] of under) {
      if (this.entered.has(key) || this.pending.has(key) || this.held.has(key)) continue;
      if (!this.armed || this.rearming.some((prefix) => key.startsWith(prefix))) this.held.add(key);
      else if (target.holdMs > 0)
        this.pending.set(
          key,
          setTimeout(() => this.enter(key, target), target.holdMs),
        );
      else this.enter(key, target);
    }
    this.armed = true;
    this.rearming = [];
  }

  /** Leaves the targets the feet are no longer on, and stops waiting on their holds. */
  private forgetAllBut(under: Map<string, FeetTarget>): void {
    for (const [key, target] of this.entered) if (!under.has(key)) this.exit(key, target);
    for (const [key, timer] of this.pending) {
      if (under.has(key)) continue;
      clearTimeout(timer);
      this.pending.delete(key);
    }
    for (const key of this.held) if (!under.has(key)) this.held.delete(key);
  }

  /** Leaves everything, as when the feet leave the ground or the game. */
  private leaveAll(): void {
    for (const [key, target] of this.entered) this.exit(key, target);
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    this.held.clear();
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

/**
 * Feeds pointer events on the viewport to a {@link MouseFeet} while `mouse-feet` mode is on, so the pointer fires the
 * rules' foot and jump interactions as player 1.
 *
 * @param viewportRef the game viewport
 * @param cameraRules the rules the camera (and so the feet) can fire, for the scenes shown now
 * @param onPlayerInteraction called for each interaction that begins
 * @param when whether the feet are on (`mouse-feet` mode), and whether they wait, as during a scene change; switching
 * off or pausing forgets everything without firing exits
 */
export function useMouseFeet(
  viewportRef: RefObject<HTMLElement | null>,
  cameraRules: CameraRuleTarget[] | undefined,
  onPlayerInteraction: ((event: CameraRuleEvent) => void) | undefined,
  when: { enabled: boolean; paused?: boolean },
): void {
  const { enabled, paused = false } = when;
  const [feet] = useState(() => new MouseFeet());
  const runsRef = useRef(new Map<SceneScope, number>());

  useEffect(() => {
    feet.listen(cameraRules ?? [], (event) => onPlayerInteraction?.(event));
    const runs = new Map((cameraRules ?? []).map(({ scope, run }) => [scope, run]));
    for (const [scope, run] of runs) {
      const before = runsRef.current.get(scope);
      if (isDefined(before) && before !== run) feet.rearm(scope);
    }
    runsRef.current = runs;
  }, [cameraRules, onPlayerInteraction, feet]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || paused || !viewport) return;
    const at = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
    const listeners: [string, (event: PointerEvent) => void][] = [
      ["pointermove", (event) => feet.move(at(event))],
      ["pointerdown", (event) => event.button === 0 && feet.down(at(event))],
      ["pointerup", (event) => feet.up(at(event)) && swallowNextClick()],
      ["pointerleave", () => feet.leave()],
      ["pointercancel", () => feet.leave()],
    ];
    const preventDefault = (event: Event) => event.preventDefault();
    listeners.forEach(([type, listener]) => viewport.addEventListener(type, listener as EventListener));
    // A drag is a jump, not a dragged image or a text selection
    viewport.addEventListener("dragstart", preventDefault);
    viewport.addEventListener("selectstart", preventDefault);
    return () => {
      listeners.forEach(([type, listener]) => viewport.removeEventListener(type, listener as EventListener));
      viewport.removeEventListener("dragstart", preventDefault);
      viewport.removeEventListener("selectstart", preventDefault);
      feet.stop();
    };
  }, [enabled, paused, viewportRef, feet]);
}
