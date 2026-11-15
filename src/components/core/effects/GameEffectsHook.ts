import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { ResolvedEffect } from "../../../entities/data/scenes/GameEffectData";
import type { GameDespawnAction, GameSpawnAction } from "../../../entities/data/scenes/GameSceneData";
import type { SceneScope, GameState, QueuedVisualEffect } from "../../../entities/state/GameState";
import { useQueueDrain } from "../QueueDrainHook";
import { targetsPlayers } from "../logic/GameEffectCompile";
import type { EndedWith } from "../logic/ActionRuns";
import type { fireRules, RuleEvent } from "../logic/GameRuleUtils";
import { sceneRun } from "../logic/GameStateUtils";
import { getSceneSlots, getShownScenes } from "../logic/RenderDataUtils";
import { sceneRoots } from "../logic/TemplateUtils";
import { resolveTargets, warnIfTrappingFloorItems } from "./EffectTargets";
import { ItemEffects, type EffectRun } from "./ItemEffects";
import { despawn, spawn } from "./Spawns";
import { PlayerEffects } from "./PlayerEffects";
import type { PlayerRegistry } from "../../camera/PlayerRegistry";
import useAppConfig from "../../../providers/AppConfigHook";
import { isDefined } from "../../../util/ObjectUtils";

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
  /** Reports that a running action has ended, with the element it ended on, if any. */
  onActionEnd: (actionId: number, ended?: EndedWith) => void;
}

/** The effect's target, for those that have one. */
const targetOf = (effect: ResolvedEffect): string | undefined => ("target" in effect ? effect.target : undefined);

/** Whether a run of a scene has reached the screen. The game's state moves on before the scene does. */
const isOnScreen = (scope: string, run: number): boolean =>
  sceneRoots(scope).some((root) => root.querySelector(`:scope > .templateBody[data-scene-run="${run}"]`) !== null);

/** Starts an effect on its elements. */
const runEffect = (effects: ItemEffects, effect: ResolvedEffect, elements: Element[], run: EffectRun): void => {
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
const isOnPlayers = (effect: ResolvedEffect): boolean =>
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
type ElementEffectStart = Pick<QueuedVisualEffect, "scope" | "run" | "where"> &
  Pick<EffectRun, "onEnd" | "onCancel" | "reducedMotion"> & {
    /** The effect. */
    effect: ResolvedEffect;
    /** Plays it. */
    effects: ItemEffects;
    /** What has happened to each player. */
    players: PlayerRegistry;
    /** Says the effect is over at once: it found nothing to play on, or (as `stop` does) it acts at once. */
    settle: () => void;
  };

/** What waiting for a scene's elements needs: the latest state, and the frames waiting, to cancel on unmount. */
interface Waiting {
  stateRef: RefObject<GameState>;
  framesRef: RefObject<Set<number>>;
}

/**
 * Tries something each frame, as the game's state moves on before the scene does, until it is done, its scene moves
 * on (when it stops quietly), or {@link TARGET_WAIT_MS} has passed (when it gives up).
 * @param attempt tries, returning whether it is done
 */
const eachFrameUntil = (
  { scope, run }: Pick<QueuedVisualEffect, "scope" | "run">,
  { stateRef, framesRef }: Waiting,
  { attempt, giveUp }: { attempt: () => boolean; giveUp: () => void },
): void => {
  const deadline = performance.now() + TARGET_WAIT_MS;
  const tryNow = () => {
    if (sceneRun(stateRef.current, scope) !== run || attempt()) return;
    if (performance.now() >= deadline) return giveUp();
    const frame = requestAnimationFrame(() => {
      framesRef.current.delete(frame);
      tryNow();
    });
    framesRef.current.add(frame);
  };
  tryNow();
};

/** Starts an effect on the elements it targets, once its scene's new elements have reached the screen. */
const startOnElements = (
  { scope, run, effect, where, effects, players, onEnd, onCancel, reducedMotion, settle }: ElementEffectStart,
  waiting: Waiting,
): void => {
  const selector = targetOf(effect);
  const attempt = () => {
    const shownScopes = getShownScenes(waiting.stateRef.current).map((scene) => scene.scope);
    const elements = resolveTargets(scope, selector, shownScopes);
    // Stopping nothing is fine, so a stop needn't wait for its elements
    const needsElements = selector !== undefined && effect.effect !== "stop";
    const ready = targetsPlayers(selector) || (isOnScreen(scope, run) && (!needsElements || elements.length > 0));
    if (!ready) return false;
    warnIfTrappingFloorItems(elements, selector, where);
    noteAffectedPlayers(elements, scope, players);
    const find = (other: string) => resolveTargets(scope, other, shownScopes)[0];
    runEffect(effects, effect, elements, { reducedMotion, find, onEnd, onCancel });
    if (effect.effect === "stop" || elements.length === 0) settle();
    return true;
  };
  const giveUp = () => {
    console.warn(`${where}.target: "${selector}" matches nothing in the scene`);
    settle();
  };
  eachFrameUntil({ scope, run }, waiting, { attempt, giveUp });
};

/**
 * Spawns or despawns once its scene's run is on screen, then says it is over: a spawn with its copy, for `actionEnd`.
 * One that can't happen (logged) is over at once.
 */
const startSpawn = (
  {
    scope,
    run,
    effect,
    where,
  }: Pick<QueuedVisualEffect, "scope" | "run" | "where"> & {
    effect: GameSpawnAction | GameDespawnAction;
  },
  settle: (element?: Element) => void,
  waiting: Waiting,
): void => {
  const attempt = () => {
    if (!isOnScreen(scope, run)) return false;
    if ("spawn" in effect) settle(spawn(scope, effect, { run, where }));
    else {
      despawn(scope, effect.despawn);
      settle();
    }
    return true;
  };
  eachFrameUntil({ scope, run }, waiting, { attempt, giveUp: () => settle() });
};

/**
 * Says, once, that an effect is over for the action waiting on it (if any): as it first finishes or is cut short on an
 * element, which the action's `actionEnd` then carries, or at once if there is nothing to wait for.
 * ponytail: an effect's elements start together and last as long, so the first to finish ends the action.
 */
const settler = (actionId: number | undefined, onActionEnd: GameEffectsContext["onActionEnd"]) => {
  let settled = false;
  return (element?: Element) => {
    if (settled || !isDefined(actionId)) return;
    settled = true;
    onActionEnd(actionId, isDefined(element) ? { id: element.id, matches: (s) => element.matches(s) } : undefined);
  };
};

/** Plays the effects rules have queued, on the elements or players each one targets. */
export function useGameEffects(
  gameState: GameState,
  { stateRef, setGameState, fire, players, onActionEnd }: GameEffectsContext,
) {
  const [{ effects, playerEffects }] = useState(() => {
    const items = new ItemEffects();
    return { effects: items, playerEffects: new PlayerEffects(items, players) };
  });
  const framesRef = useRef(new Set<number>());
  const waiting = useMemo(() => ({ stateRef, framesRef }), [stateRef]);
  const { visionSmoothing } = useAppConfig();
  const warnedRef = useRef(false);

  const start = useCallback(
    ({ scope, run, effect, event, where, actionId }: QueuedVisualEffect) => {
      const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const settle = settler(actionId, onActionEnd);
      if ("spawn" in effect || "despawn" in effect) return startSpawn({ scope, run, effect, where }, settle, waiting);
      // An effect ended by its scene closing or resetting doesn't count as finishing, nor does one on a removed copy
      const onEnd = (element: Element) => {
        if (sceneRun(stateRef.current, scope) === run && element.isConnected)
          fire(scope, endPick(effect.effect, element, event));
        settle(element);
      };
      const onCancel = (element: Element) => settle(element);
      if (isOnPlayers(effect)) {
        const find = () => undefined;
        const playerRun = { scope, event, where, onEnd, onCancel, reducedMotion: reducedMotion(), find };
        const started = visionSmoothing ? playerEffects.play(effect, playerRun) : 0;
        if (!visionSmoothing && !warnedRef.current) {
          warnedRef.current = true;
          console.warn(`${where}: player effects need visionSmoothing on, to follow who is who`);
        }
        if (started === 0 || effect.effect === "stop") settle();
        return;
      }
      const starting = { scope, run, effect, where, effects, players, onEnd, onCancel, settle };
      startOnElements({ ...starting, reducedMotion: reducedMotion() }, waiting);
    },
    [stateRef, fire, effects, players, playerEffects, visionSmoothing, onActionEnd, waiting],
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
