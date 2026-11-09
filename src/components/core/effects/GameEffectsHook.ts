import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { GameEffect } from "../../../entities/data/scenes/GameEffectData";
import type { SceneScope, GameState, QueuedVisualEffect } from "../../../entities/state/GameState";
import { useQueueDrain } from "../QueueDrainHook";
import { targetsPlayers } from "../logic/GameEffectCompile";
import type { fireRules, RuleEvent } from "../logic/GameRuleUtils";
import { sceneRun } from "../logic/GameStateUtils";
import { getSceneSlots, getShownScenes } from "../logic/RenderDataUtils";
import { sceneRoots } from "../logic/TemplateUtils";
import { resolveTargets, warnIfTrappingFloorItems } from "./EffectTargets";
import { ItemEffects, type EffectRun } from "./ItemEffects";
import { PlayerEffects } from "./PlayerEffects";
import type { PlayerRegistry } from "../../camera/PlayerRegistry";
import useAppConfig from "../../../providers/AppConfigHook";

/** How long an effect waits for its scene's elements to appear, before saying they haven't. */
const TARGET_WAIT_MS = 5000;

/** What effects need from the game's rules. */
interface GameEffectsContext {
  /** The latest game state. */
  stateRef: RefObject<GameState>;
  /** Changes the game state. */
  setGameState: Dispatch<SetStateAction<GameState>>;
  /** Fires rules of a scene. */
  fire: (scope: SceneScope, pick: Parameters<typeof fireRules>[3]) => void;
  /** What has happened to each player. */
  players: PlayerRegistry;
}

/** The effect's target, for those that have one. */
const targetOf = (effect: GameEffect): string | undefined => ("target" in effect ? effect.target : undefined);

/** Whether a run of a scene has reached the screen. The game's state moves on before the scene does. */
const isOnScreen = (scope: string, run: number): boolean =>
  sceneRoots(scope).some((root) => root.querySelector(`:scope > .templateBody[data-scene-run="${run}"]`) !== null);

/** Starts an effect on its elements. */
const runEffect = (effects: ItemEffects, effect: GameEffect, elements: Element[], run: EffectRun): void => {
  if (effect.effect === "quake") effects.quake(effect, elements, run);
  else if (effect.effect === "item-fall") effects.fall(effect, elements, run);
  else if (effect.effect === "item-move") effects.move(effect, elements, run);
  else if (effect.effect === "highlight") effects.highlight(effect, elements, run);
  else if (effect.effect === "stop") effects.stop(elements, effect.stop);
};

/** The rule an effect ending fires: one naming the effect, and any target it has matching the element. */
const endPick =
  (name: string, element: Element, event: RuleEvent): Parameters<typeof fireRules>[3] =>
  (trigger) => {
    if (!("effectEnd" in trigger) || trigger.effectEnd !== name) return undefined;
    if (trigger.target !== undefined && !element.matches(trigger.target)) return undefined;
    const number = element instanceof HTMLElement ? Number(element.dataset.player) : NaN;
    return { id: element.id, interaction: "", player: Number.isNaN(number) ? event.player : number };
  };

/** Whether an effect acts on players, chosen with `players`, rather than on elements. */
const isOnPlayers = (effect: GameEffect): boolean =>
  effect.effect.startsWith("player-") || (effect.effect === "stop" && effect.players !== undefined);

/** A scene and which run of it is showing, by its place on screen: reset scenes share their parent's. */
type ShownRuns = Map<SceneScope, { scope: SceneScope; run: number }>;

/** The scope of the scene a reset scene shows for. */
const parentScope = (scope: SceneScope): SceneScope => scope.replace(/(\/reset)+$/, "");

/** What's showing now, by place on screen. */
const shownRuns = (state: GameState): ShownRuns =>
  new Map(getShownScenes(state).map(({ scope }) => [parentScope(scope), { scope, run: sceneRun(state, scope) }]));

/** What the change from one set of shown scenes to the next means for players. */
export interface SceneEnds {
  /** Whether the game has moved to another scene, which restores everyone. */
  moved: boolean;
  /** Otherwise, which scenes have reset, by their place on screen. */
  reset: SceneScope[];
}

/** Works out what the change from one set of shown scenes to the next means for players. */
export const sceneEnds = (before: ShownRuns, after: ShownRuns): SceneEnds => {
  const moved = before.size !== after.size || Array.from(after.keys()).some((place) => !before.has(place));
  if (moved) return { moved, reset: [] };
  const reset = Array.from(after.entries())
    .filter(([place, { scope, run }]) => before.get(place)?.scope !== scope || before.get(place)?.run !== run)
    .map(([place]) => place);
  return { moved, reset };
};

/** Ends what has happened to players as their scene ends; see {@link sceneEnds}. */
function useSceneEnds(gameState: GameState, players: PlayerRegistry, playerEffects: PlayerEffects) {
  const shownRef = useRef<ShownRuns>(new Map());
  const key = shownRunsKeyOf(gameState);
  useEffect(() => {
    const after = shownRuns(gameState);
    const { moved, reset } = sceneEnds(shownRef.current, after);
    const hadScenes = shownRef.current.size > 0;
    shownRef.current = after;
    if (!hadScenes) return;
    for (const id of players.knownIds()) {
      if (moved) playerEffects.end(id, false);
      else {
        const place = parentScope(players.setByOf(id) ?? "");
        if (reset.includes(place)) playerEffects.end(id, keepsRemoved(gameState, place));
      }
    }
    // Only as what is showing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, players, playerEffects]);
}

/** Whether a scene keeps its removed players as it resets. */
const keepsRemoved = (state: GameState, place: SceneScope): boolean =>
  getSceneSlots(state).find(({ scope }) => scope === place)?.scene.component.keepRemovedPlayers === true;

/** Identifies what is showing and which run of it. */
const shownRunsKeyOf = (state: GameState): string =>
  getShownScenes(state)
    .map(({ scope }) => `${scope}#${sceneRun(state, scope)}`)
    .join("\n");

/** Notes the players an effect's elements include, so it ends with their scene, as their wrappers aren't rebuilt. */
const noteAffectedPlayers = (elements: Element[], scope: SceneScope, players: PlayerRegistry): void => {
  for (const element of elements) {
    const number = element instanceof HTMLElement ? Number(element.dataset.player) : NaN;
    const id = Number.isNaN(number) ? undefined : players.idOf(number);
    if (id !== undefined) players.touch(id, scope);
  }
};

/** What is needed to start an effect on elements. */
type ElementEffectStart = Pick<QueuedVisualEffect, "scope" | "run" | "effect" | "where"> &
  Pick<EffectRun, "onEnd" | "reducedMotion"> & {
    /** Plays it. */
    effects: ItemEffects;
    /** What has happened to each player. */
    players: PlayerRegistry;
  };

/**
 * Starts an effect on the elements it targets, once its scene's new elements have reached the screen, as the game's
 * state moves on before the scene does. It gives up if its scene moves on first.
 */
const startOnElements = (
  { scope, run, effect, where, effects, players, onEnd, reducedMotion }: ElementEffectStart,
  stateRef: RefObject<GameState>,
  framesRef: RefObject<Set<number>>,
): void => {
  const selector = targetOf(effect);
  const deadline = performance.now() + TARGET_WAIT_MS;
  const attempt = () => {
    const state = stateRef.current;
    if (sceneRun(state, scope) !== run) return;
    const shownScopes = getShownScenes(state).map((scene) => scene.scope);
    const elements = resolveTargets(scope, selector, shownScopes);
    const ready =
      targetsPlayers(selector) || (isOnScreen(scope, run) && (selector === undefined || elements.length > 0));
    if (ready) {
      warnIfTrappingFloorItems(elements, selector, where);
      noteAffectedPlayers(elements, scope, players);
      const find = (other: string) => resolveTargets(scope, other, shownScopes)[0];
      runEffect(effects, effect, elements, { reducedMotion, find, onEnd });
    } else if (performance.now() < deadline) {
      const frame = requestAnimationFrame(() => {
        framesRef.current.delete(frame);
        attempt();
      });
      framesRef.current.add(frame);
    } else console.warn(`${where}.target: "${selector}" matches nothing in the scene`);
  };
  attempt();
};

/** Plays the effects rules have queued, on the elements or players each one targets. */
export function useGameEffects(gameState: GameState, { stateRef, setGameState, fire, players }: GameEffectsContext) {
  const [{ effects, playerEffects }] = useState(() => {
    const items = new ItemEffects();
    return { effects: items, playerEffects: new PlayerEffects(items, players) };
  });
  const framesRef = useRef(new Set<number>());
  const { visionSmoothing } = useAppConfig();
  const warnedRef = useRef(false);

  const start = useCallback(
    ({ scope, run, effect, event, where }: QueuedVisualEffect) => {
      const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // An effect ended by its scene closing or resetting doesn't count as finishing
      const onEnd = (element: Element) => {
        if (sceneRun(stateRef.current, scope) === run) fire(scope, endPick(effect.effect, element, event));
      };
      if (isOnPlayers(effect)) {
        if (visionSmoothing) {
          const find = () => undefined;
          playerEffects.play(effect, { scope, event, where, onEnd, reducedMotion: reducedMotion(), find });
        } else if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn(`${where}: player effects need visionSmoothing on, to follow who is who`);
        }
        return;
      }
      const starting = { scope, run, effect, where, effects, players, onEnd, reducedMotion: reducedMotion() };
      startOnElements(starting, stateRef, framesRef);
    },
    [stateRef, fire, effects, players, playerEffects, visionSmoothing],
  );

  const withoutUpTo = useCallback(
    (state: GameState, id: number): GameState => ({
      ...state,
      session: { ...state.session, visualEffects: state.session.visualEffects.filter((queued) => queued.id > id) },
    }),
    [],
  );
  useQueueDrain(gameState.session.visualEffects, start, withoutUpTo, setGameState);
  useSceneEnds(gameState, players, playerEffects);

  useEffect(() => {
    const frames = framesRef.current;
    return () => frames.forEach((frame) => cancelAnimationFrame(frame));
  }, []);

  return playerEffects;
}
