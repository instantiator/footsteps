import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { DelayedAction, SceneScope, GameState } from "../../entities/state/GameState";
import { isDefined } from "../../util/ObjectUtils";
import { useQueueDrain } from "./QueueDrainHook";
import {
  applyDelayedAction,
  fireRules,
  NO_EVENT,
  runWhens,
  type RuleEnvironment,
  type WhenEdges,
  whenKey,
} from "./logic/GameRuleUtils";
import { getShownScenes } from "./logic/RenderDataUtils";

/** Fires chosen rules of one scene. */
type FireRules = (scope: SceneScope, pick: Parameters<typeof fireRules>[3]) => void;

/** Waits for `when` rules with `forMs`, by {@link whenKey}. */
type HeldWhens = Map<string, ReturnType<typeof setTimeout>>;

/**
 * Starts a wait for each shown `when` rule with `forMs` that has just turned true, and cancels those whose rule has
 * turned false or whose scene is no longer shown. A wait that runs its course fires its rule.
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
  for (const { scope, component } of getShownScenes(state)) {
    (component.rules ?? []).forEach(({ on }, ruleIndex) => {
      const key = whenKey(state, scope, ruleIndex);
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
 * `forMs` fires once it has stayed true that long.
 */
export function useWhenRules(
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

/** The state without the delayed actions up to and including this id. */
const withoutDelayedUpTo = (state: GameState, id: number): GameState => ({
  ...state,
  session: { ...state.session, delayedActions: state.session.delayedActions.filter((delayed) => delayed.id > id) },
});

/**
 * Runs the actions rules have delayed, each once, after its `delayMs`. One whose scene has closed or reset by then
 * does nothing, so a timer that outlives its scene is harmless.
 */
export function useDelayedActions(
  env: RuleEnvironment,
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
) {
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const start = useCallback(
    (delayed: DelayedAction) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setGameState((state) => applyDelayedAction(env, state, delayed));
      }, delayed.action.delayMs);
      timersRef.current.add(timer);
    },
    [env, setGameState],
  );
  useQueueDrain(gameState.session.delayedActions, start, withoutDelayedUpTo, setGameState);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);
}
