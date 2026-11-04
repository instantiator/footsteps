import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { GameEffect } from "../../../entities/data/displays/GameEffectData";
import type { GameState, QueuedVisualEffect } from "../../../entities/state/GameState";
import { useQueueDrain } from "../QueueDrainHook";
import { targetsPlayers } from "../logic/GameEffectCompile";
import { displayRun } from "../logic/GameStateUtils";
import { getShownDisplays } from "../logic/RenderDataUtils";
import { displayRoots } from "../logic/TemplateUtils";
import { resolveTargets, warnIfTrappingDepth } from "./EffectTargets";
import { ItemEffects, type EffectRun } from "./ItemEffects";

/** How long an effect waits for its display's elements to appear, before saying they haven't. */
const TARGET_WAIT_MS = 5000;

/** The effect's target, for those that have one. */
const targetOf = (effect: GameEffect): string | undefined => ("target" in effect ? effect.target : undefined);

/** Whether a run of a display has reached the screen. The game's state moves on before the scene does. */
const isOnScreen = (scope: string, run: number): boolean =>
  displayRoots(scope).some((root) => root.querySelector(`:scope > .templateBody[data-display-run="${run}"]`) !== null);

/** Starts an effect on its elements. */
const runEffect = (effects: ItemEffects, effect: GameEffect, elements: Element[], run: EffectRun): void => {
  if (effect.effect === "quake") effects.quake(effect, elements, run);
  else if (effect.effect === "item-fall") effects.fall(effect, elements, run);
  else if (effect.effect === "item-move") effects.move(effect, elements, run);
};

/** Plays the effects rules have queued, on the elements each one targets. */
export function useGameEffects(
  gameState: GameState,
  stateRef: RefObject<GameState>,
  setGameState: Dispatch<SetStateAction<GameState>>,
) {
  const effectsRef = useRef(new ItemEffects());
  const framesRef = useRef(new Set<number>());

  const start = useCallback(
    ({ scope, run, effect, where }: QueuedVisualEffect) => {
      const selector = targetOf(effect);
      const deadline = performance.now() + TARGET_WAIT_MS;
      const attempt = () => {
        const state = stateRef.current;
        if (displayRun(state, scope) !== run) return; // its display has moved on
        const shownScopes = getShownDisplays(state).map((display) => display.scope);
        const elements = resolveTargets(scope, selector, shownScopes);
        const ready =
          targetsPlayers(selector) || (isOnScreen(scope, run) && (selector === undefined || elements.length > 0));
        if (ready) {
          warnIfTrappingDepth(elements, selector, where);
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const find = (other: string) => resolveTargets(scope, other, shownScopes)[0];
          runEffect(effectsRef.current, effect, elements, { reducedMotion, find, onEnd: () => {} });
        } else if (performance.now() < deadline) {
          const frame = requestAnimationFrame(() => {
            framesRef.current.delete(frame);
            attempt();
          });
          framesRef.current.add(frame);
        } else console.warn(`${where}.target: "${selector}" matches nothing in the display`);
      };
      attempt();
    },
    [stateRef],
  );

  const withoutUpTo = useCallback(
    (state: GameState, id: number): GameState => ({
      ...state,
      session: { ...state.session, visualEffects: state.session.visualEffects.filter((queued) => queued.id > id) },
    }),
    [],
  );
  useQueueDrain(gameState.session.visualEffects, start, withoutUpTo, setGameState);

  useEffect(() => {
    const frames = framesRef.current;
    return () => frames.forEach((frame) => cancelAnimationFrame(frame));
  }, []);
}
