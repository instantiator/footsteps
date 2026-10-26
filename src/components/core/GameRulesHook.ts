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
  type RuleEnvironment,
  type WhenEdges,
} from "./logic/GameRuleUtils";
import { getShownDisplays, overviewScope, type ShownDisplay } from "./logic/RenderDataUtils";
import type { DisplayDomEvent } from "./logic/TemplateUtils";

/**
 * How long after a display is shown to check that its rules' selectors match something. Templates load
 * asynchronously, so the check waits for them.
 * ponytail: a fixed wait; if it misleads, have the template component report when it has rendered.
 */
const SELECTOR_CHECK_DELAY_MS = 2000;

/** The template containers of a display, by its scope. */
const displayRoots = (scope: DisplayScope): Element[] =>
  Array.from(document.querySelectorAll("[data-display-scope]")).filter(
    (element) => element instanceof HTMLElement && element.dataset.displayScope === scope,
  );

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

/** After any change, fires the `when` rules that have become true; skipped if the state moved on meanwhile. */
function useWhenRules(env: RuleEnvironment, gameState: GameState, setGameState: Dispatch<SetStateAction<GameState>>) {
  const edgesRef = useRef<WhenEdges>(new Map());
  useEffect(() => {
    const result = runWhens(env, gameState, edgesRef.current);
    edgesRef.current = result.edges;
    if (result.state !== gameState) setGameState((previous) => (previous === gameState ? result.state : previous));
  }, [env, gameState, setGameState]);
}

/**
 * Runs the shown displays' rules: fires them for events inside their templates, when they are shown (`start`),
 * on timers (`every`, `after`), and when a `when` expression becomes true after any change.
 *
 * Rules change the game only through pure functions of the latest state, so events that arrive between renders
 * compose, and no rule ever receives `setGameState`.
 *
 * @returns the handler for events inside a display's templates
 */
export function useGameRules() {
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
  useWhenRules(env, gameState, setGameState);

  /** Fires a display's rules for an event in its template. A click no rule takes moves on from the title screen. */
  return useCallback(
    (scope: DisplayScope, event: DisplayDomEvent) => {
      const display = getShownDisplays(stateRef.current).find((d) => d.scope === scope);
      if (!isDefined(display)) return;
      const events = (display.component.rules ?? []).map((rule) => matchDisplayEvent(rule.on, event));
      if (events.some(isDefined)) {
        fire(scope, (_, ruleIndex) => events[ruleIndex]);
      } else if (event.kind === "click" && scope === overviewScope("game-overview-title")) {
        setGameState((previous) => leaveTitleScreen(previous) ?? previous);
      }
    },
    [fire, setGameState],
  );
}
