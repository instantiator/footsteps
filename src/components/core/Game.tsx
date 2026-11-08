import _ from "lodash";
import { useReward } from "partycles";
import { useMediaQuery } from "@uidotdev/usehooks";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GameOverviewScenePurpose } from "../../entities/data/scenes/GameSceneData";
import type { GameChallengeId } from "../../entities/data/GameChallengeData";
import type { GameRewardData } from "../../entities/data/GameData";
import type { GameChallengeAnswerValidation } from "../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../entities/data/GameStageData";
import type { SceneScope, GameState, QueuedEffect } from "../../entities/state/GameState";
import useAppConfig from "../../providers/AppConfigHook";
import { useGameData } from "../../providers/GameDataHook";
import useGameMusic from "../../providers/GameMusicHook";
import { useGameState } from "../../providers/GameStateHook";
import { PlayerRegistryContext } from "../../providers/PlayerRegistryContext";
import { isDefined } from "../../util/ObjectUtils";
import GameSceneComponent, { type LayerHint } from "./scene/GameSceneComponent";
import { centreOnScreen, playerWrappers, resolveTargets } from "./effects/EffectTargets";
import type { PlayerEffects } from "./effects/PlayerEffects";
import "./Game.css";
import GameStylesheets from "./GameStylesheets";
import GameLayersLayout, { type GameLayers } from "./layout/GameLayersLayout";
import { resolveAvatarMode, resolveSceneMode } from "./logic/AvatarModeUtils";
import { leaveTitleScreen } from "./logic/GameClickUtils";
import { findChallengeState } from "./logic/GameDataUtils";
import type { SceneDomEvent } from "./logic/TemplateUtils";
import { completeChallenge, validateAnswer } from "./logic/GameStateUtils";
import {
  getSceneKey,
  getLayeredRenderData,
  getShownScenes,
  type GameSceneRenderData,
  type LayeredGameSceneRenderData,
} from "./logic/RenderDataUtils";
import { playAudio } from "./sfx/AudioUtils";
import RewardBurst from "./sfx/RewardBurst";
import { useGameRules } from "./GameRulesHook";
import { useWakeLock } from "./WakeLockHook";

/**
 * Submits an answer to a challenge.
 * @returns true if the answer solves the challenge, otherwise the reasons it was wrong (possibly none)
 */
export type GameAnswerFunction = (
  stageId: GameStageId,
  challengeId: GameChallengeId,
  answer: string,
) => GameChallengeAnswerValidation[] | true;

/** The URL of a named resource, or undefined if the game doesn't name one or it doesn't resolve. */
const resourceUrl = (resources: Record<string, string>, key: string | undefined) =>
  isDefined(key) ? resources[key] : undefined;

/** The ids of the stages the player has completed. */
const completedStageIds = (gameState: GameState): GameStageId[] =>
  gameState.stages.filter((s) => s.completion === "completed").map((s) => s.stage.id);

/** Rewards completed stages, and plays music and sound effects as the player moves around the game, as the game data says. */
function useGameFeedback(reducedMotion: boolean) {
  const { gameState } = useGameState();
  const { resources } = useGameData();
  const { playMusic } = useGameMusic();
  const { sounds, reward: rewardData } = gameState.gameData;
  const { reward } = useReward("reward-element", rewardData?.animation ?? "fireworks", {
    particleCount: rewardData?.particleCount ?? 200,
  });

  // Previous values, to react only to changes; refs because nothing renders from them.
  // Progress starts from the loaded state, so continuing a saved game doesn't replay its rewards.
  const progressTracker = useRef(completedStageIds(gameState));
  const overviewTracker = useRef<GameOverviewScenePurpose | null>(null);
  const stageIdTracker = useRef<GameStageId | null>(null);

  useEffect(() => {
    const newProgress = completedStageIds(gameState);
    if (!_.isEqual(newProgress, progressTracker.current)) {
      if (isDefined(rewardData) && !reducedMotion) reward();
      const completed = resourceUrl(resources, sounds?.stageCompletedSoundResource);
      if (isDefined(completed)) playAudio(completed);
      progressTracker.current = newProgress;
    }
  }, [gameState, reward, rewardData, resources, sounds, reducedMotion]);

  useEffect(() => {
    const overviewScene = gameState.current.overviewScene;
    if (overviewScene === overviewTracker.current) return;
    const opening = resourceUrl(resources, sounds?.openingMusicResource);
    const closing = resourceUrl(resources, sounds?.closingMusicResource);
    if (overviewScene === "game-overview-stages" && isDefined(opening)) playMusic(opening);
    if (overviewScene === "game-overview-complete" && isDefined(closing)) playMusic(closing);
    overviewTracker.current = overviewScene;
  }, [gameState, playMusic, resources, sounds]);

  useEffect(() => {
    const stageId = gameState.current.stageId;
    if (stageId === stageIdTracker.current) return;
    const opened = resourceUrl(resources, sounds?.stageOpenedSoundResource);
    if (isDefined(stageId) && isDefined(opened)) playAudio(opened);
    stageIdTracker.current = stageId;
  }, [gameState, resources, sounds]);
}

/** A celebration a rule asked for, while it shows. */
interface ShownReward {
  id: number | string;
  reward: GameRewardData;
  /** Where on screen it starts; the middle of the game if not given. */
  at?: { x: number; y: number };
}

/**
 * The rewards a rule's reward action shows: one from each element it targets, or one from the middle of the game if it
 * has no target. So does one whose element has gone by now, as rewards outlive their scene.
 */
const rewardsFor = (
  { id, effect, scope, event }: QueuedEffect,
  reward: GameRewardData,
  { shownScopes, playerEffects }: { shownScopes: SceneScope[]; playerEffects: PlayerEffects },
): ShownReward[] => {
  const selector = "reward" in effect ? effect.target : undefined;
  const choice = "reward" in effect ? effect.players : undefined;
  const elements = isDefined(choice)
    ? playerWrappers(choice, event.player)
    : isDefined(selector)
      ? resolveTargets(scope, selector, shownScopes)
      : [];
  if (elements.length === 0) return [{ id, reward }];
  // A player's canvas fills the scene, so its centre would be the middle of the scene, not the player
  const centreOf = (element: Element) =>
    element.classList.contains("player") ? playerEffects.bodyCentre(element) : centreOnScreen(element);
  return elements.map((element, index) => ({ id: `${id}-${index}`, reward, at: centreOf(element) }));
};

/**
 * Plays the sounds and rewards rules queue: each once, after its `delayMs`, alongside any others, then drops it from
 * the queue. Rewards aren't shown to players who prefer reduced motion; their sounds still play.
 * @returns the rewards showing now, to render
 */
function useRuleEffects(reducedMotion: boolean, playerEffects: PlayerEffects) {
  const { gameState, setGameState } = useGameState();
  const { resources } = useGameData();
  const [shown, setShown] = useState<ShownReward[]>([]);
  // The highest id played; ids only grow, so a queue worked out twice (as React may) plays nothing twice
  const playedRef = useRef(0);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const { effects } = gameState.session;
  const stateRef = useRef(gameState);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const fresh = effects.filter(({ id }) => id > playedRef.current);
    if (fresh.length === 0) return;
    playedRef.current = Math.max(...fresh.map(({ id }) => id));
    for (const queued of fresh) {
      const { effect } = queued;
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        if ("sound" in effect) void playAudio(resources[effect.sound]);
        else if (!reducedMotion) {
          const shownScopes = getShownScenes(stateRef.current).map((scene) => scene.scope);
          setShown((rewards) => [...rewards, ...rewardsFor(queued, effect.reward, { shownScopes, playerEffects })]);
        }
      }, effect.delayMs ?? 0);
      timersRef.current.add(timer);
    }
    const played = playedRef.current;
    setGameState((state) => ({
      ...state,
      session: { ...state.session, effects: state.session.effects.filter(({ id }) => id > played) },
    }));
  }, [effects, resources, reducedMotion, setGameState, playerEffects]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const done = useCallback(
    (id: number | string) => setShown((rewards) => rewards.filter((reward) => reward.id !== id)),
    [],
  );
  return { shown, done };
}

/**
 * Enter or Space on the title screen moves on, as a click does. Only when nothing has focus,
 * so focused buttons and inputs keep their own keys.
 */
function useTitleScreenKeys() {
  const { gameState, setGameState } = useGameState();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== "Enter" && event.key !== " ") || event.target !== document.body) return;
      const next = leaveTitleScreen(gameState);
      if (!isDefined(next)) return;
      event.preventDefault();
      setGameState(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, setGameState]);
}

/** What the scenes call when the player answers, or something happens in a template. */
interface SceneHandlers {
  /** Submits an answer to a challenge. */
  onAnswer: GameAnswerFunction;
  /** Responds to an event inside a scene's template. */
  onSceneEvent: (scope: SceneScope, event: SceneDomEvent) => void;
}

/** One scene component per render datum, for the given layer. */
const createSceneComponents = (
  renderData: (GameSceneRenderData | undefined)[] | undefined,
  layerHint: LayerHint,
  handlers: SceneHandlers,
): ReactNode[] | undefined =>
  renderData
    ?.filter(isDefined)
    .map((renderDatum) => (
      <GameSceneComponent
        key={`${renderDatum.stageId}-${renderDatum.challengeId}-scene-component`}
        render={renderDatum}
        layerHint={layerHint}
        onAnswer={handlers.onAnswer}
        onSceneEvent={(event) => handlers.onSceneEvent(renderDatum.scope, event)}
      />
    ));

/** Background and foreground nodes for the overview, stage, and challenge layers. */
const createLayers = (renderData: LayeredGameSceneRenderData, handlers: SceneHandlers): GameLayers => {
  const layer = (data: (GameSceneRenderData | undefined)[] | undefined) => ({
    backgroundLayerNodes: createSceneComponents(data, "background", handlers),
    foregroundLayerNodes: createSceneComponents(data, "foreground", handlers),
  });
  return {
    overview: layer([renderData.overviewRenderData]),
    stage: layer([renderData.stageRenderData]),
    challenges: layer(renderData.challengesRenderData),
  };
};

/**
 * The callback function used when an answer is submitted (or tested) by a scene component.
 * Accepts the answer, and if correct, updates the game state to complete the challenge.
 *
 * @returns true if the answer is correct (ie. the challenge is completed), or an array of validations.
 *
 * NB. Not all incorrect answers result in validations.
 * An empty array of validation also indicates an incorrect answer.
 */
function useAnswerHandler(): GameAnswerFunction {
  const { gameState, setGameState } = useGameState();
  return useCallback(
    (stageId, challengeId, answer): GameChallengeAnswerValidation[] | true => {
      const challengeState = findChallengeState(gameState, stageId, challengeId);
      if (challengeState.succeeded) {
        return true; // ignore further attempts to submit an answer to a succeeded challenge
      }
      const validations = validateAnswer(challengeState.challenge, answer);
      if (validations !== true) {
        return validations;
      }
      setGameState(completeChallenge(gameState, stageId, challengeId));
      return true;
    },
    [gameState, setGameState],
  );
}

/**
 * The game itself: builds layered render data from the game state, and hands it to {@link GameLayersLayout}
 * along with the click handling, feedback (music, sound effects, rewards) and title screen keys.
 */
export default function Game() {
  const config = useAppConfig();
  // Starts as the config says, and the HUD switches it
  const [debug, setDebug] = useState(config.debug);
  const toggleDebug = useCallback(() => setDebug((on) => !on), []);
  const { gameId, resources } = useGameData();
  const { gameState } = useGameState();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useGameFeedback(reducedMotion);
  useTitleScreenKeys();
  useWakeLock(!gameState.stages.every((stage) => stage.completion === "completed"));

  const onAnswer = useAnswerHandler();
  const renderData = useMemo(() => getLayeredRenderData(gameState, resources, gameId), [gameState, resources, gameId]);
  const sceneKey = useMemo(() => getSceneKey(renderData), [renderData]);
  const { onSceneEvent, cameraRules, onPlayerInteraction, players, playerEffects } = useGameRules();
  const ruleRewards = useRuleEffects(reducedMotion, playerEffects);
  const layers = useMemo(
    () => createLayers(renderData, { onAnswer, onSceneEvent }),
    [renderData, onAnswer, onSceneEvent],
  );
  const avatar = useMemo(() => resolveAvatarMode(gameState.gameData, renderData), [gameState.gameData, renderData]);
  const sceneMode = useMemo(() => resolveSceneMode(gameState.gameData, renderData), [gameState.gameData, renderData]);

  return (
    <div
      id="game-container"
      style={{
        position: "absolute",
        top: "5px",
        left: "5px",
        right: "5px",
        bottom: "5px",
        overflow: "hidden",
        ...gameState.gameData.gameContainerStyle,
      }}
    >
      <GameStylesheets />
      <div
        id="reward-element"
        style={{ position: "absolute", top: "50vh", left: "50vw", width: 0, height: 0, pointerEvents: "none" }}
      />
      {ruleRewards.shown.map(({ id, reward, at }) => (
        <RewardBurst key={id} id={id} reward={reward} at={at} onDone={() => ruleRewards.done(id)} />
      ))}
      <PlayerRegistryContext.Provider value={players}>
        <GameLayersLayout
          debug={debug}
          onToggleDebug={toggleDebug}
          gameLayers={layers}
          sceneKey={sceneKey}
          avatar={avatar}
          sceneMode={sceneMode}
          cameraRules={cameraRules}
          onPlayerInteraction={onPlayerInteraction}
        />
      </PlayerRegistryContext.Provider>
    </div>
  );
}
