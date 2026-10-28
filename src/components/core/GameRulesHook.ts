import { useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { DisplayScope, GameState } from "../../entities/state/GameState";
import { useGameData } from "../../providers/GameDataHook";
import { useGameState } from "../../providers/GameStateHook";
import { isDefined } from "../../util/ObjectUtils";
import { leaveTitleScreen } from "./logic/GameClickUtils";
import {
  fireRules,
  matchDisplayEvent,
  NO_EVENT,
  ruleDelay,
  runWhens,
  triggerInteractions,
  type RuleEnvironment,
  type RuleEvent,
  type WhenEdges,
  whenKey,
} from "./logic/GameRuleUtils";
import { getShownDisplays, overviewScope, type ShownDisplay } from "./logic/RenderDataUtils";
import { displayRoots, matchTarget, type DisplayDomEvent } from "./logic/TemplateUtils";
import type { CameraRuleEvent, CameraRuleTarget } from "./layout/PlayerInteractionHook";
import type { CameraInteraction } from "../camera/PlayerMonitor";
import {
  DEFAULT_INTERACTION_THRESHOLD,
  POINTER_INTERACTIONS,
  type GameTrigger,
} from "../../entities/data/displays/GameDisplayData";

/** Whether an interaction comes from a mouse or pointer, so the camera ignores it. */
const isPointerInteraction = (interaction: string): boolean =>
  POINTER_INTERACTIONS.some((pointer) => pointer === interaction);

/**
 * How long after a display is shown to check that its rules' selectors match something. Templates load
 * asynchronously, so the check waits for them.
 * ponytail: a fixed wait; if it misleads, have the template component report when it has rendered.
 */
const SELECTOR_CHECK_DELAY_MS = 2000;

/** Warns about rules whose selectors match nothing in the display, as that is usually a typo. */
const warnUnmatchedSelectors = (display: ShownDisplay): void => {
  const roots = displayRoots(display.scope);
  (display.component.rules ?? []).forEach((rule, ruleIndex) => {
    if (!("target" in rule.on)) return;
    const selector = rule.on.target;
    if (roots.some((root) => root.querySelector(selector) !== null)) return;
    console.warn(`${display.scope} › rules[${ruleIndex}].on.target: "${selector}" matches nothing in the display`);
  });
};

/** The shown displays' rules that camera interactions can fire. */
const getCameraRules = (state: GameState): CameraRuleTarget[] =>
  getShownDisplays(state).flatMap(({ scope, component }) =>
    (component.rules ?? []).flatMap(({ on }, ruleIndex) => {
      if (!("interact" in on)) return [];
      const interactions = triggerInteractions(on).filter((i): i is CameraInteraction => !isPointerInteraction(i));
      if (interactions.length === 0) return [];
      const threshold = on.threshold ?? DEFAULT_INTERACTION_THRESHOLD;
      return [
        {
          scope,
          ruleIndex,
          selector: on.target,
          interactions,
          threshold,
          includeCovered: on.includeCovered === true,
          holdMs: on.holdMs ?? 0,
        },
      ];
    }),
  );

/** Fires chosen rules of one display. */
type FireRules = (scope: DisplayScope, pick: Parameters<typeof fireRules>[3]) => void;

/**
 * Starts a newly shown display: fires its `start` rules, schedules its `every` and `after` rules, and checks its
 * selectors once its templates have had time to load.
 * @param getState the latest state, for working out durations
 * @returns how to stop its timers
 */
const startDisplay = (
  display: ShownDisplay,
  env: RuleEnvironment,
  getState: () => GameState,
  fire: FireRules,
): (() => void) => {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  // `state` is what the wait's duration is worked out from: after a firing, the state that firing leads to, as
  // React won't have applied it yet
  const schedule = (ruleIndex: number, repeat: boolean, state: GameState) => {
    const ms = ruleDelay(env, state, display, ruleIndex);
    if (!isDefined(ms)) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      const pick: Parameters<typeof fireRules>[3] = (_, index) => (index === ruleIndex ? NO_EVENT : undefined);
      fire(display.scope, pick);
      if (repeat) schedule(ruleIndex, true, fireRules(env, getState(), display.scope, pick));
    }, ms);
    timers.add(timer);
  };

  fire(display.scope, (trigger) => ("start" in trigger ? NO_EVENT : undefined));
  (display.component.rules ?? []).forEach(({ on }, ruleIndex) => {
    if ("every" in on || "after" in on) schedule(ruleIndex, "every" in on, getState());
  });
  timers.add(setTimeout(() => warnUnmatchedSelectors(display), SELECTOR_CHECK_DELAY_MS));
  return () => timers.forEach(clearTimeout);
};

/**
 * Starts displays as they are shown, and stops those hidden. A display that stays shown while others change (eg. a
 * stage's shared display as its challenges move on) keeps its timers running.
 */
function useDisplayLifecycles(
  env: RuleEnvironment,
  gameState: GameState,
  stateRef: RefObject<GameState>,
  fire: FireRules,
) {
  const runningRef = useRef(new Map<DisplayScope, () => void>());
  const shownKey = getShownDisplays(gameState)
    .map((display) => display.scope)
    .join("\n");

  useEffect(() => {
    const running = runningRef.current;
    const shown = new Map(getShownDisplays(stateRef.current).map((display) => [display.scope, display]));
    for (const [scope, stop] of running) {
      if (shown.has(scope)) continue;
      stop();
      running.delete(scope);
    }
    for (const display of shown.values()) {
      if (!running.has(display.scope))
        running.set(
          display.scope,
          startDisplay(display, env, () => stateRef.current, fire),
        );
    }
  }, [shownKey, env, stateRef, fire]);

  useEffect(() => {
    const running = runningRef.current;
    return () => {
      running.forEach((stop) => stop());
      running.clear();
    };
  }, []);
}

/** One rule of one display. */
interface RuleAt {
  scope: DisplayScope;
  ruleIndex: number;
}

/** A rule waiting for the mouse to stay over an element for its `holdMs`. */
interface MouseHold {
  scope: DisplayScope;
  /** The element the mouse is over. */
  element: Element;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Holds rules whose trigger has a `holdMs`: the mouse entering one of their elements starts a wait, and the rule fires
 * if it is still there when the wait is over. Leaving the element, or the display being hidden, cancels the wait.
 */
function useMouseHolds(gameState: GameState, fire: FireRules) {
  const holdsRef = useRef(new Set<MouseHold>());
  const shownKey = getShownDisplays(gameState)
    .map((display) => display.scope)
    .join("\n");

  useEffect(() => {
    const shown = new Set(shownKey.split("\n"));
    for (const hold of holdsRef.current) {
      if (shown.has(hold.scope)) continue;
      clearTimeout(hold.timer);
      holdsRef.current.delete(hold);
    }
  }, [shownKey]);

  useEffect(() => {
    const holds = holdsRef.current;
    return () => holds.forEach((hold) => clearTimeout(hold.timer));
  }, []);

  return useMemo(
    () => ({
      /**
       * Starts waiting, if the rule holds and the mouse has just entered its element.
       * @returns whether the rule is now waiting, rather than firing straight away
       */
      start: ({ scope, ruleIndex }: RuleAt, trigger: GameTrigger, event: DisplayDomEvent, matched: RuleEvent) => {
        const holdMs = "interact" in trigger ? (trigger.holdMs ?? 0) : 0;
        const element = "target" in trigger ? matchTarget(event, trigger.target) : undefined;
        if (holdMs <= 0 || matched.interaction !== "mouse-enter" || !isDefined(element)) return false;
        const hold: MouseHold = {
          scope,
          element,
          timer: setTimeout(() => {
            holdsRef.current.delete(hold);
            fire(scope, (_, index) => (index === ruleIndex ? matched : undefined));
          }, holdMs),
        };
        holdsRef.current.add(hold);
        return true;
      },
      /** Cancels the waits for the elements the mouse has just left. */
      leave: (scope: DisplayScope, event: DisplayDomEvent) => {
        for (const hold of holdsRef.current) {
          const left = hold.element.contains(event.target) && !(event.related && hold.element.contains(event.related));
          if (hold.scope !== scope || !left) continue;
          clearTimeout(hold.timer);
          holdsRef.current.delete(hold);
        }
      },
    }),
    [fire],
  );
}

/** Waits for `when` rules with `forMs`, by {@link whenKey}. */
type HeldWhens = Map<string, ReturnType<typeof setTimeout>>;

/**
 * Starts a wait for each shown `when` rule with `forMs` that has just turned true, and cancels those whose rule has
 * turned false or whose display is no longer shown. A wait that runs its course fires its rule.
 * @param edges each rule's value before the change, and each shown rule's value now
 */
const followHeldWhens = (
  state: GameState,
  { before, after }: { before: WhenEdges; after: WhenEdges },
  waits: HeldWhens,
  fire: FireRules,
) => {
  for (const [key, timer] of waits) {
    if (after.get(key) === true) continue;
    clearTimeout(timer);
    waits.delete(key);
  }
  for (const { scope, component } of getShownDisplays(state)) {
    (component.rules ?? []).forEach(({ on }, ruleIndex) => {
      const key = whenKey(scope, ruleIndex);
      if (!("when" in on) || !isDefined(on.forMs) || waits.has(key)) return;
      if (before.get(key) !== false || after.get(key) !== true) return;
      const timer = setTimeout(() => {
        waits.delete(key);
        fire(scope, (_, index) => (index === ruleIndex ? NO_EVENT : undefined));
      }, on.forMs);
      waits.set(key, timer);
    });
  }
};

/**
 * After any change, fires the `when` rules that have become true; skipped if the state moved on meanwhile. A rule with
 * `forMs` fires once it has stayed true that long (see {@link followHeldWhens}).
 */
function useWhenRules(
  env: RuleEnvironment,
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  fire: FireRules,
) {
  const edgesRef = useRef<WhenEdges>(new Map());
  const waitsRef = useRef<HeldWhens>(new Map());
  useEffect(() => {
    const before = edgesRef.current;
    const result = runWhens(env, gameState, before);
    edgesRef.current = result.edges;
    followHeldWhens(gameState, { before, after: result.edges }, waitsRef.current, fire);
    // Another update (eg. draining played effects) may land first: the rules then run again on it, not dropped
    if (result.state !== gameState) {
      setGameState((previous) => (previous === gameState ? result.state : runWhens(env, previous, before).state));
    }
  }, [env, gameState, setGameState, fire]);

  useEffect(() => {
    const waits = waitsRef.current;
    return () => waits.forEach((timer) => clearTimeout(timer));
  }, []);
}

/** What {@link useGameRules} gives the game. */
export interface GameRules {
  /** Fires a display's rules for an event in its templates. */
  onDisplayEvent: (scope: DisplayScope, event: DisplayDomEvent) => void;
  /** The shown displays' rules that the camera can fire. */
  cameraRules: CameraRuleTarget[];
  /** Fires the camera rule that watches the element a player interacted with. */
  onPlayerInteraction: (event: CameraRuleEvent) => void;
}

/**
 * Runs the shown displays' rules: fires them for events inside their templates, when they are shown (`start`),
 * on timers (`every`, `after`), and when a `when` expression becomes true after any change.
 *
 * Rules change the game only through pure functions of the latest state, so events that arrive between renders
 * compose, and no rule ever receives `setGameState`.
 *
 * @returns the handler for events inside a display's templates, and the rules the camera can fire with their handler
 */
export function useGameRules(): GameRules {
  const { gameId, expressions } = useGameData();
  const { gameState, setGameState } = useGameState();
  const env: RuleEnvironment = useMemo(() => ({ gameId, expressions }), [gameId, expressions]);
  const stateRef = useRef(gameState);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const fire: FireRules = useCallback(
    (scope, pick) => setGameState((previous) => fireRules(env, previous, scope, pick)),
    [env, setGameState],
  );
  useDisplayLifecycles(env, gameState, stateRef, fire);
  const mouseHolds = useMouseHolds(gameState, fire);
  useWhenRules(env, gameState, setGameState, fire);

  /** Fires a display's rules for an event in its template. A click no rule takes moves on from the title screen. */
  const onDisplayEvent = useCallback(
    (scope: DisplayScope, event: DisplayDomEvent) => {
      const display = getShownDisplays(stateRef.current).find((d) => d.scope === scope);
      if (!isDefined(display)) return;
      if (event.kind === "mouseOut") mouseHolds.leave(scope, event);
      const events = (display.component.rules ?? []).map((rule, ruleIndex) => {
        const matched = matchDisplayEvent(rule.on, event);
        const held = isDefined(matched) && mouseHolds.start({ scope, ruleIndex }, rule.on, event, matched);
        return held ? undefined : matched;
      });
      if (events.some(isDefined)) {
        fire(scope, (_, ruleIndex) => events[ruleIndex]);
      } else if (event.kind === "click" && scope === overviewScope("game-overview-title")) {
        setGameState((previous) => leaveTitleScreen(previous) ?? previous);
      }
    },
    [fire, setGameState, mouseHolds],
  );

  /** Fires the camera rule that watches the element the player interacted with. */
  const onPlayerInteraction = useCallback(
    ({ scope, ruleIndex, element, interaction }: CameraRuleEvent) =>
      fire(scope, (_, index) => (index === ruleIndex ? { id: element.id, interaction } : undefined)),
    [fire],
  );

  const cameraRules = useMemo(() => getCameraRules(gameState), [gameState]);
  return { onDisplayEvent, cameraRules, onPlayerInteraction };
}
