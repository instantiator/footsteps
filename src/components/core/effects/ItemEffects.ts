import type {
  GameEffectDuration,
  GameEffectPosition,
  GameHighlightEffect,
  GameHighlightStep,
  GameItemFallEffect,
  GameItemMoveEffect,
  GameQuakeEffect,
} from "../../../entities/data/displays/GameEffectData";
import { easingFunction } from "./EasingProbe";
import { DISPLAY_FRAME_CLASS, centreOnScreen, displayDistance, displayRect, type ScreenPoint } from "./EffectTargets";

/** How far an item is shaken at some point in a quake, as a % of the display. */
export interface QuakeStep extends ScreenPoint {
  /** How far through the quake this is (0–1). */
  offset: number;
}

/** What {@link quakeSteps} works from. */
interface QuakeShape {
  dx: number;
  dy: number;
  /** How many times to shake there and back. */
  cycles: number;
  /** How much of `dx` and `dy` apply at each point through the quake (0–1). */
  strength: (progress: number) => number;
  /** A random number from 0 to 1. */
  random?: () => number;
}

/** A shake's size each way, as a fraction of its full size, so they don't all look alike. */
const shakeSize = (random: () => number): number => (0.6 + 0.4 * random()) * (random() < 0.5 ? -1 : 1);

/**
 * The steps of a quake: each cycle goes one way, then the other, then back to the middle.
 * @returns steps from rest to rest
 */
export const quakeSteps = ({ dx, dy, cycles, strength, random = Math.random }: QuakeShape): QuakeStep[] => {
  const steps: QuakeStep[] = [{ offset: 0, x: 0, y: 0 }];
  for (let cycle = 0; cycle < cycles; cycle++) {
    const [sizeX, sizeY] = [shakeSize(random), shakeSize(random)];
    const out = (cycle + 0.25) / cycles;
    const back = (cycle + 0.75) / cycles;
    steps.push(
      { offset: out, x: dx * sizeX * strength(out), y: dy * sizeY * strength(out) },
      { offset: back, x: -dx * sizeX * strength(back), y: -dy * sizeY * strength(back) },
      { offset: (cycle + 1) / cycles, x: 0, y: 0 },
    );
  }
  return steps;
};

/** The size of an item and of the display it is in, each with its position. */
type Bounds = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

/**
 * How much to enlarge an item while it shakes, so a full-size item doesn't show a gap at the display's edge.
 * @param dx how far it shakes horizontally, as a % of the display's width
 * @param dy how far it shakes vertically, as a % of the display's height
 * @returns 1 for an item that doesn't reach every edge of the display
 */
export const coverScale = (item: Bounds, display: Bounds, dx: number, dy: number): number => {
  const reachesEdges =
    item.left <= display.left + 1 &&
    item.top <= display.top + 1 &&
    item.right >= display.right - 1 &&
    item.bottom >= display.bottom - 1;
  if (!reachesEdges || item.width <= 0 || item.height <= 0) return 1;
  const needX = (2 * (Math.abs(dx) / 100) * display.width) / item.width;
  const needY = (2 * (Math.abs(dy) / 100) * display.height) / item.height;
  return 1 + Math.max(needX, needY);
};

/** How far to move an item to take it off the bottom of the display, as a % of its height. */
export const fallDistance = (itemTop: number, display: Pick<Bounds, "bottom" | "height">): number =>
  display.height > 0 ? ((display.bottom - itemTop) / display.height) * 100 : 100;

/** Where a position puts an element's centre on screen. */
const positionOnScreen = (
  position: GameEffectPosition,
  display: Pick<Bounds, "left" | "top" | "width" | "height">,
  now: ScreenPoint,
  centreOf: (selector: string) => ScreenPoint | undefined,
): ScreenPoint => {
  const percent = (amount: { left: number; top: number }) => ({
    x: (amount.left / 100) * display.width,
    y: (amount.top / 100) * display.height,
  });
  if ("by" in position) {
    const { x, y } = percent(position.by);
    return { x: now.x + x, y: now.y + y };
  }
  const { x, y } = percent(position);
  const from = "from" in position ? (centreOf(position.from) ?? now) : { x: display.left, y: display.top };
  return { x: from.x + x, y: from.y + y };
};

/** What {@link moveOffsets} needs to know about an element. */
interface MoveMeasures {
  /** Its centre on screen as it appears now, part way through any earlier move. */
  visual: ScreenPoint;
  /** Its centre on screen with no move applied. */
  layout: ScreenPoint;
  /** The display's bounds on screen. */
  display: Pick<Bounds, "left" | "top" | "width" | "height">;
  /** The centre on screen of another element, if it is there. */
  centreOf: (selector: string) => ScreenPoint | undefined;
}

/**
 * Where a move begins and ends, as distances from where the element's template puts it, as a % of the display.
 * @returns the start and end
 */
export const moveOffsets = (
  start: GameEffectPosition | undefined,
  end: GameEffectPosition,
  { visual, layout, display, centreOf }: MoveMeasures,
): [ScreenPoint, ScreenPoint] => {
  const offset = (position: GameEffectPosition | undefined): ScreenPoint => {
    const { x, y } = position === undefined ? visual : positionOnScreen(position, display, visual, centreOf);
    return { x: ((x - layout.x) / display.width) * 100, y: ((y - layout.y) / display.height) * 100 };
  };
  return [offset(start), offset(end)];
};

/** The CSS property each of a highlight's styles sets. */
const HIGHLIGHT_STYLES = { filter: "filter", shadow: "boxShadow", outline: "outline" } as const;

/** The length of a step that doesn't give one. */
const DEFAULT_STEP_MS = 1000;

/** The length of a highlight's sequence. */
const sequenceLength = (sequence: GameHighlightStep[]): number =>
  sequence.reduce((total, { durationMs = DEFAULT_STEP_MS }) => total + durationMs, 0);

/**
 * The keyframes of a highlight. A step with an easing builds from the step before, or from the element's own styles.
 * One without applies at full strength throughout.
 * @param own the element's own value for each CSS property the sequence sets
 */
export const highlightKeyframes = (sequence: GameHighlightStep[], own: Record<string, string>): Keyframe[] => {
  const total = sequenceLength(sequence);
  const stylesOf = (step: GameHighlightStep) => {
    const styles = { ...own };
    for (const [style, property] of Object.entries(HIGHLIGHT_STYLES)) {
      const value = step[style as keyof typeof HIGHLIGHT_STYLES];
      if (value !== undefined) styles[property] = value;
    }
    return styles;
  };
  let elapsed = 0;
  let before = own;
  const keyframes: Keyframe[] = sequence.map((step) => {
    const styles = stylesOf(step);
    const offset = elapsed / total;
    elapsed += step.durationMs ?? DEFAULT_STEP_MS;
    const keyframe =
      step.easing === undefined
        ? { ...styles, offset, easing: "step-end" }
        : { ...before, offset, easing: step.easing };
    before = styles;
    return keyframe;
  });
  return [...keyframes, { ...before, offset: 1 }];
};

/** The CSS properties a highlight's sequence sets. */
const highlightProperties = (sequence: GameHighlightStep[]): string[] =>
  Object.entries(HIGHLIGHT_STYLES)
    .filter(([style]) => sequence.some((step) => step[style as keyof typeof HIGHLIGHT_STYLES] !== undefined))
    .map(([, property]) => property);

/** The duration of one play of an effect, and how many times it plays. */
const timing = (durationMs: GameEffectDuration, cycleMs: number): Pick<EffectTiming, "duration" | "iterations"> =>
  durationMs === "indefinite" ? { duration: cycleMs, iterations: Infinity } : { duration: durationMs };

/** What a quake's motion is worked out from: makes the steps of it, differently each time. */
const quakeMotion = ({ dx = 0, dy = 0, durationMs = 1000, cycleMs = 100, easing }: GameQuakeEffect) => {
  const indefinite = durationMs === "indefinite";
  const cycles = indefinite || cycleMs <= 0 ? 1 : Math.max(1, Math.round(durationMs / cycleMs));
  const eased = !indefinite && easing !== undefined ? easingFunction(easing) : undefined;
  const strength = (progress: number) => (eased === undefined ? 1 : Math.max(0, 1 - eased(progress)));
  return () => quakeSteps({ dx, dy, cycles, strength });
};

/** A CSS property's name as a stylesheet writes it. */
const cssName = (property: string): string => property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** What effects need to know about the rule that started them. */
export interface EffectRun {
  /** Called as the effect finishes on each element. */
  onEnd: (element: Element) => void;
  /** Whether players prefer reduced motion. */
  reducedMotion: boolean;
  /** Looks for the element a position is measured from, in the display whose rule started the effect. */
  find: (selector: string) => Element | undefined;
}

/** An animation, as effects use it. */
type EffectAnimation = Pick<Animation, "onfinish" | "cancel" | "persist">;

/** An effect on an element. */
interface EffectOn {
  /** The element. */
  element: Element;
  /** The effect's name. */
  name: string;
}

/**
 * Plays effects on elements with the Web Animations API, which isn't kept in the `style` attribute that template
 * re-renders rewrite. An effect's own properties (`translate`, `scale`) apply before any `transform` of the element,
 * and add to any other effect's, so its template's positioning and other effects all still apply.
 *
 * Each element runs one of each effect: firing one again restarts it. An effect's animations go with its element, and a
 * display's template is rebuilt as it closes or resets, which is what ends them. So they aren't cancelled as a display
 * closes, as that would snap an item back into view during the scene's fade.
 */
export class ItemEffects {
  private readonly running = new WeakMap<Element, Map<string, EffectAnimation>>();

  /** Shakes the elements. A dialog's frames always share one motion, to keep their layers lined up. */
  quake(effect: GameQuakeEffect, elements: Element[], run: EffectRun): void {
    if (run.reducedMotion) {
      elements.forEach(run.onEnd);
      return;
    }
    const { dx = 0, dy = 0, consistentMotion = true, durationMs = 1000, cycleMs = 100 } = effect;
    const motion = quakeMotion(effect);
    const shared = motion();
    for (const element of elements) {
      const sharesMotion = consistentMotion || element.classList.contains(DISPLAY_FRAME_CLASS);
      const scale = coverScale(element.getBoundingClientRect(), displayRect(element), dx, dy);
      const keyframes = (sharesMotion ? shared : motion()).map(({ offset, x, y }) => ({
        offset,
        translate: displayDistance(element, { x, y }),
        ...(scale !== 1 && { scale: String(scale) }),
      }));
      this.play({ element, name: "quake" }, keyframes, timing(durationMs, cycleMs), run);
    }
  }

  /** Plays a series of styles on the elements, after which they return to their own. */
  highlight({ sequence, durationMs }: GameHighlightEffect, elements: Element[], run: EffectRun): void {
    const total = sequenceLength(sequence);
    if (total <= 0) return;
    const iterations = durationMs === "indefinite" ? Infinity : durationMs === undefined ? 1 : durationMs / total;
    const properties = highlightProperties(sequence);
    for (const element of elements) {
      this.cancel(element, "highlight"); // so its own styles aren't read part way through
      const computed = getComputedStyle(element);
      const own = Object.fromEntries(
        properties.map((property) => [property, computed.getPropertyValue(cssName(property))]),
      );
      const options = { duration: total, iterations, composite: "replace" as const };
      this.play({ element, name: "highlight" }, highlightKeyframes(sequence, own), options, run);
    }
  }

  /** Ends effects on the elements, which return to where their templates put them. */
  stop(elements: Element[], name: string | undefined): void {
    for (const element of elements) {
      const names = name === undefined ? Array.from(this.running.get(element)?.keys() ?? []) : [name];
      names.forEach((running) => this.cancel(element, running));
    }
  }

  /** Drops the elements off the bottom of the display. */
  fall(effect: GameItemFallEffect, elements: Element[], run: EffectRun): void {
    for (const element of elements) {
      this.cancel(element, "item-fall");
      const distance = fallDistance(element.getBoundingClientRect().top, displayRect(element));
      const keyframes = [
        { translate: displayDistance(element, { x: 0, y: 0 }) },
        { translate: displayDistance(element, { x: 0, y: distance }) },
      ];
      this.playToEnd({ element, name: "item-fall" }, keyframes, effect, run);
    }
  }

  /** Moves the elements. */
  move(effect: GameItemMoveEffect, elements: Element[], run: EffectRun): void {
    const centreOf = (selector: string) => {
      const other = run.find(selector);
      return other === undefined ? undefined : centreOnScreen(other);
    };
    for (const element of elements) {
      const visual = centreOnScreen(element);
      this.cancel(element, "item-move");
      const measures = { visual, layout: centreOnScreen(element), display: displayRect(element), centreOf };
      const keyframes = moveOffsets(effect.start, effect.end, measures).map((offset) => ({
        translate: displayDistance(element, offset),
      }));
      this.playToEnd({ element, name: "item-move" }, keyframes, effect, run);
    }
  }

  /**
   * Plays an effect with a lasting end, where it stays. If indefinite, it starts again instead; for players who prefer
   * reduced motion, it goes straight to its end.
   */
  private playToEnd(
    on: EffectOn,
    keyframes: Keyframe[],
    { durationMs = 1000, cycleMs = 1000, easing = "linear" }: GameItemFallEffect | GameItemMoveEffect,
    run: EffectRun,
  ): void {
    const lasting = run.reducedMotion || durationMs !== "indefinite";
    const options: KeyframeAnimationOptions = run.reducedMotion
      ? { duration: 0 }
      : { ...timing(durationMs, cycleMs), easing };
    // A later effect finishing would otherwise let the browser drop this one, snapping the element back
    const animation = this.play(on, keyframes, lasting ? { ...options, fill: "forwards" } : options, run);
    if (lasting) animation.persist();
  }

  /** Starts an effect on an element, in place of any it is already running of the same name. */
  private play(
    { element, name }: EffectOn,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    run: EffectRun,
  ): EffectAnimation {
    this.cancel(element, name);
    const animation = element.animate(keyframes, { composite: "add", ...options });
    animation.onfinish = () => run.onEnd(element);
    const effects = this.running.get(element) ?? new Map<string, EffectAnimation>();
    effects.set(name, animation);
    this.running.set(element, effects);
    return animation;
  }

  /** Ends an effect on an element, if it is running one. That doesn't count as it finishing. */
  cancel(element: Element, name: string): void {
    const effects = this.running.get(element);
    const animation = effects?.get(name);
    if (animation === undefined) return;
    animation.onfinish = null;
    animation.cancel();
    effects?.delete(name);
  }
}
