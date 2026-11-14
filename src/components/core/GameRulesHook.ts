import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SceneScope, GameState } from "../../entities/state/GameState";
import { useGameData } from "../../providers/GameDataHook";
import { useGameState } from "../../providers/GameStateHook";
import { isDefined } from "../../util/ObjectUtils";
import { resolveTargets } from "./effects/EffectTargets";
import { useGameEffects } from "./effects/GameEffectsHook";
import type { PlayerEffects } from "./effects/PlayerEffects";
import { useDelayedActions, useWhenRules } from "./RuleWaitsHook";
import { leaveTitleScreen } from "./logic/GameClickUtils";
import { targetsPlayers } from "./logic/GameEffectCompile";
import { sceneRun } from "./logic/GameStateUtils";
import {
  fireRules,
  matchSceneEvent,
  NO_EVENT,
  ruleDelay,
  triggerInteractions,
  type RuleEnvironment,
  type RuleEvent,
} from "./logic/GameRuleUtils";
import { getShownScenes, overviewScope, type ShownScene } from "./logic/RenderDataUtils";
import { sceneRoots, matchTarget, type SceneDomEvent } from "./logic/TemplateUtils";
import type { CameraRuleEvent, CameraRuleTarget } from "./layout/PlayerInteractionHook";
import type { CameraInteraction } from "../camera/PlayerMonitor";
import { PlayerRegistry } from "../camera/PlayerRegistry";
import type { PublishedPositions } from "../camera/PositionPublisher";
import {
  DEFAULT_INTERACTION_THRESHOLD,
  POINTER_INTERACTIONS,
  type GameTrigger,
} from "../../entities/data/scenes/GameSceneData";

/** Whether an interaction comes from a mouse or pointer, so the camera ignores it. */
const isPointerInteraction = (interaction: string): boolean =>
  POINTER_INTERACTIONS.some((pointer) => pointer === interaction);

/**
 * How long after a scene is shown to check that its rules' selectors match something. Templates load
 * asynchronously, so the check waits for them.
 * ponytail: a fixed wait; if it misleads, have the template component report when it has rendered.
 */
const SELECTOR_CHECK_DELAY_MS = 2000;

/** Warns about rules whose selectors match nothing in the scene, as that is usually a typo. */
const warnUnmatchedSelectors = (scene: ShownScene): void => {
  const roots = sceneRoots(scene.scope);
  (scene.component.rules ?? []).forEach((rule, ruleIndex) => {
    const selector = "target" in rule.on ? rule.on.target : undefined;
    if (isDefined(selector) && !roots.some((root) => root.querySelector(selector) !== null)) {
      console.warn(`${scene.scope} › rules[${ruleIndex}].on.target: "${selector}" matches nothing in the scene`);
    }
    rule.do.forEach((action, a) => {
      const target = "target" in action ? action.target : undefined;
      if (!isDefined(target) || targetsPlayers(target) || resolveTargets(scene.scope, target, []).length > 0) return;
      console.warn(`${scene.scope} › rules[${ruleIndex}].do[${a}].target: "${target}" matches nothing in the scene`);
    });
  });
};

/** Most times a scene may reset within {@link RESTART_WINDOW_MS}, before it counts as a loop and is stopped. */
const MAX_RESTARTS = 10;

/** The period {@link MAX_RESTARTS} applies to. */
const RESTART_WINDOW_MS = 1000;

/** Identifies the shown scenes and which run of each, so what depends on them can follow any change. */
const shownRunsKey = (state: GameState): string =>
  getShownScenes(state)
    .map(({ scope }) => `${scope}#${sceneRun(state, scope)}`)
    .join("\n");

/** The shown scenes' rules that camera interactions can fire. */
const getCameraRules = (state: GameState): CameraRuleTarget[] =>
  getShownScenes(state).flatMap(({ scope, component }) =>
    (component.rules ?? []).flatMap(({ on }, ruleIndex) => {
      if (!("interact" in on)) return [];
      const interactions = triggerInteractions(on).filter((i): i is CameraInteraction => !isPointerInteraction(i));
      if (interactions.length === 0) return [];
      const threshold = on.threshold ?? DEFAULT_INTERACTION_THRESHOLD;
      return [
        {
          scope,
          run: sceneRun(state, scope),
          ruleIndex,
          selector: on.target,
          interactions,
          threshold,
          includeCovered: on.includeCovered === true,
          holdMs: on.holdMs ?? 0,
          within: on.within,
        },
      ];
    }),
  );

/** Fires chosen rules of one scene. */
type FireRules = (scope: SceneScope, pick: Parameters<typeof fireRules>[3]) => void;

/**
 * Starts a newly shown scene: fires its `start` rules, schedules its `every` and `after` rules, and checks its
 * selectors once its templates have had time to load.
 * @param getState the latest state, for working out durations
 * @returns how to stop its timers
 */
const startScene = (
  scene: ShownScene,
  env: RuleEnvironment,
  getState: () => GameState,
  fire: FireRules,
): (() => void) => {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  // `state` is what the wait's duration is worked out from: after a firing, the state that firing leads to, as
  // React won't have applied it yet
  const schedule = (ruleIndex: number, repeat: boolean, state: GameState) => {
    const ms = ruleDelay(env, state, scene, ruleIndex);
    if (!isDefined(ms)) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      const pick: Parameters<typeof fireRules>[3] = (_, index) => (index === ruleIndex ? NO_EVENT : undefined);
      fire(scene.scope, pick);
      if (repeat) schedule(ruleIndex, true, fireRules(env, getState(), scene.scope, pick));
    }, ms);
    timers.add(timer);
  };

  fire(scene.scope, (trigger) => ("start" in trigger ? NO_EVENT : undefined));
  (scene.component.rules ?? []).forEach(({ on }, ruleIndex) => {
    if ("every" in on || "after" in on) schedule(ruleIndex, "every" in on, getState());
  });
  timers.add(setTimeout(() => warnUnmatchedSelectors(scene), SELECTOR_CHECK_DELAY_MS));
  return () => timers.forEach(clearTimeout);
};

/** A scene started by {@link useSceneLifecycles}. */
interface RunningScene {
  /** Which run of the scene it is. */
  run: number;
  /** Stops its timers. */
  stop: () => void;
}

/**
 * Whether a scene has reset so often lately that something must be resetting it each time it starts, which the
 * check on `start` rules when the game loads can't see (eg. a `start` rule sets a value that a `when` rule resets on).
 * @param restarts when each scene last reset, kept up to date here
 */
const isRestartLoop = (restarts: Map<SceneScope, number[]>, scope: SceneScope): boolean => {
  const now = Date.now();
  const recent = [...(restarts.get(scope) ?? []).filter((at) => now - at < RESTART_WINDOW_MS), now];
  restarts.set(scope, recent);
  if (recent.length <= MAX_RESTARTS) return false;
  console.error(`${scope}: stopped, as it reset more than ${MAX_RESTARTS} times in ${RESTART_WINDOW_MS} ms`);
  return true;
};

/**
 * Starts scenes as they are shown, and again as they reset, and stops those hidden. A scene that stays shown while
 * others change (eg. a stage's shared scene as its challenges move on) keeps its timers running.
 */
function useSceneLifecycles(
  env: RuleEnvironment,
  gameState: GameState,
  stateRef: RefObject<GameState>,
  fire: FireRules,
) {
  const runningRef = useRef(new Map<SceneScope, RunningScene>());
  const restartsRef = useRef(new Map<SceneScope, number[]>());
  const shownKey = shownRunsKey(gameState);

  useEffect(() => {
    const running = runningRef.current;
    const state = stateRef.current;
    const shown = new Map(getShownScenes(state).map((scene) => [scene.scope, scene]));
    for (const [scope, { run, stop }] of running) {
      if (shown.has(scope) && run === sceneRun(state, scope)) continue;
      stop();
      running.delete(scope);
      if (shown.has(scope) && isRestartLoop(restartsRef.current, scope)) shown.delete(scope);
    }
    for (const scene of shown.values()) {
      if (!running.has(scene.scope))
        running.set(scene.scope, {
          run: sceneRun(state, scene.scope),
          stop: startScene(scene, env, () => stateRef.current, fire),
        });
    }
  }, [shownKey, env, stateRef, fire]);

  useEffect(() => {
    const running = runningRef.current;
    return () => {
      running.forEach(({ stop }) => stop());
      running.clear();
    };
  }, []);
}

/** One rule of one scene. */
interface RuleAt {
  scope: SceneScope;
  ruleIndex: number;
}

/** A rule waiting for the mouse to stay over an element for its `holdMs`. */
interface MouseHold {
  scope: SceneScope;
  /** The scene and run it began in, as in {@link shownRunsKey}. */
  runKey: string;
  /** The element the mouse is over. */
  element: Element;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Holds rules whose trigger has a `holdMs`: the mouse entering one of their elements starts a wait, and the rule fires
 * if it is still there when the wait is over. Leaving the element, or the scene being hidden or reset, cancels the
 * wait.
 */
function useMouseHolds(gameState: GameState, stateRef: RefObject<GameState>, fire: FireRules) {
  const holdsRef = useRef(new Set<MouseHold>());
  const shownKey = shownRunsKey(gameState);

  useEffect(() => {
    const shown = new Set(shownKey.split("\n"));
    for (const hold of holdsRef.current) {
      if (shown.has(hold.runKey)) continue;
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
      start: ({ scope, ruleIndex }: RuleAt, trigger: GameTrigger, event: SceneDomEvent, matched: RuleEvent) => {
        const holdMs = "interact" in trigger ? (trigger.holdMs ?? 0) : 0;
        const selector = "target" in trigger ? trigger.target : undefined;
        const element = isDefined(selector) ? matchTarget(event, selector) : undefined;
        if (holdMs <= 0 || matched.interaction !== "mouse-enter" || !isDefined(element)) return false;
        const hold: MouseHold = {
          scope,
          runKey: `${scope}#${sceneRun(stateRef.current, scope)}`,
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
      leave: (scope: SceneScope, event: SceneDomEvent) => {
        for (const hold of holdsRef.current) {
          const left = hold.element.contains(event.target) && !(event.related && hold.element.contains(event.related));
          if (hold.scope !== scope || !left) continue;
          clearTimeout(hold.timer);
          holdsRef.current.delete(hold);
        }
      },
    }),
    [fire, stateRef],
  );
}

/** What {@link useGameRules} gives the game. */
export interface GameRules {
  /** Fires a scene's rules for an event in its templates. */
  onSceneEvent: (scope: SceneScope, event: SceneDomEvent) => void;
  /** The shown scenes' rules that the camera can fire. */
  cameraRules: CameraRuleTarget[];
  /** Fires the camera rule that watches the element a player interacted with. */
  onPlayerInteraction: (event: CameraRuleEvent) => void;
  /** What has happened to each player, for the camera to follow. */
  players: PlayerRegistry;
  /** Plays effects on players, and knows where their bodies are. */
  playerEffects: PlayerEffects;
  /** Gives rules and templates every player's position, in one change. */
  onPlayerPositions: (positions: PublishedPositions) => void;
}

/**
 * Runs the shown scenes' rules: fires them for events inside their templates, when they are shown (`start`),
 * on timers (`every`, `after`), and when a `when` expression becomes true after any change.
 *
 * Rules change the game only through pure functions of the latest state, so events that arrive between renders
 * compose, and no rule ever receives `setGameState`.
 *
 * @returns the handler for events inside a scene's templates, and the rules the camera can fire with their handler
 */
export function useGameRules(): GameRules {
  const { gameId, expressions } = useGameData();
  const { gameState, setGameState } = useGameState();
  const env: RuleEnvironment = useMemo(() => ({ gameId, expressions }), [gameId, expressions]);
  const [players] = useState(() => new PlayerRegistry());
  useEffect(
    () =>
      players.onCounts((counts) =>
        setGameState((state) => ({ ...state, session: { ...state.session, players: counts } })),
      ),
    [players, setGameState],
  );
  const onPlayerPositions = useCallback(
    (positions: PublishedPositions) =>
      setGameState((state) => ({ ...state, session: { ...state.session, playerPositions: positions } })),
    [setGameState],
  );
  const stateRef = useRef(gameState);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const fire: FireRules = useCallback(
    (scope, pick) => setGameState((previous) => fireRules(env, previous, scope, pick)),
    [env, setGameState],
  );
  useSceneLifecycles(env, gameState, stateRef, fire);
  const mouseHolds = useMouseHolds(gameState, stateRef, fire);
  useWhenRules(env, gameState, setGameState, fire);
  useDelayedActions(env, gameState, setGameState);
  const playerEffects = useGameEffects(gameState, { stateRef, setGameState, fire, players });

  /** Fires a scene's rules for an event in its template. A click no rule takes moves on from the title screen. */
  const onSceneEvent = useCallback(
    (scope: SceneScope, event: SceneDomEvent) => {
      const scene = getShownScenes(stateRef.current).find((d) => d.scope === scope);
      if (!isDefined(scene)) return;
      if (event.kind === "mouseOut") mouseHolds.leave(scope, event);
      const events = (scene.component.rules ?? []).map((rule, ruleIndex) => {
        const matched = matchSceneEvent(rule.on, event);
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
    ({ scope, ruleIndex, element, interaction, player }: CameraRuleEvent) =>
      fire(scope, (_, index) => (index === ruleIndex ? { id: element?.id ?? "", interaction, player } : undefined)),
    [fire],
  );

  const cameraRules = useMemo(() => getCameraRules(gameState), [gameState]);
  return { onSceneEvent, cameraRules, onPlayerInteraction, players, playerEffects, onPlayerPositions };
}
