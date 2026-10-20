import _ from "lodash";
import { useReward } from "partycles";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { GameOverviewDisplayPurpose } from "../../entities/data/displays/GameDisplayData";
import type { GameChallengeId } from "../../entities/data/GameChallengeData";
import type { GameChallengeAnswerValidation } from "../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../entities/data/GameStageData";
import useFeatureFlags from "../../providers/FeatureFlagsHook";
import { useGameData } from "../../providers/GameDataHook";
import useGameMusic from "../../providers/GameMusicHook";
import { useGameState } from "../../providers/GameStateHook";
import { isDefined } from "../../util/ObjectUtils";
import GameDisplayComponent, { type LayerHint } from "./display/GameDisplayComponent";
import "./Game.css";
import GameLayersLayout, { type GameLayers } from "./layout/GameLayersLayout";
import { getNewGameStateForClick, leaveTitleScreen } from "./logic/GameClickUtils";
import { findChallengeState } from "./logic/GameDataUtils";
import { completeChallenge, validateAnswer } from "./logic/GameStateUtils";
import {
  getLayeredRenderData,
  type GameDisplayRenderData,
  type LayeredGameDisplayRenderData,
} from "./logic/RenderDataUtils";
import { playAudio } from "./sfx/AudioUtils";

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

/** Rewards completed stages, and plays music and sound effects as the player moves around the game, as the game data says. */
function useGameFeedback() {
  const { gameState } = useGameState();
  const { resources } = useGameData();
  const { playMusic } = useGameMusic();
  const { sounds, reward: rewardData } = gameState.gameData;
  const { reward } = useReward("reward-element", rewardData?.animation ?? "fireworks", {
    particleCount: rewardData?.particleCount ?? 200,
  });

  // Previous values, to react only to changes; refs because nothing renders from them
  const progressTracker = useRef<GameStageId[]>([]);
  const overviewTracker = useRef<GameOverviewDisplayPurpose | null>(null);
  const stageIdTracker = useRef<GameStageId | null>(null);

  useEffect(() => {
    const newProgress = gameState.stages.filter((s) => s.completion === "completed").map((s) => s.stage.id);
    if (!_.isEqual(newProgress, progressTracker.current)) {
      if (isDefined(rewardData)) reward();
      const completed = resourceUrl(resources, sounds?.stageCompletedSoundResource);
      if (isDefined(completed)) playAudio(completed);
      progressTracker.current = newProgress;
    }
  }, [gameState, reward, rewardData, resources, sounds]);

  useEffect(() => {
    const overviewDisplay = gameState.current.overviewDisplay;
    if (overviewDisplay === overviewTracker.current) return;
    const opening = resourceUrl(resources, sounds?.openingMusicResource);
    const closing = resourceUrl(resources, sounds?.closingMusicResource);
    if (overviewDisplay === "game-overview-stages" && isDefined(opening)) playMusic(opening);
    if (overviewDisplay === "game-overview-complete" && isDefined(closing)) playMusic(closing);
    overviewTracker.current = overviewDisplay;
  }, [gameState, playMusic, resources, sounds]);

  useEffect(() => {
    const stageId = gameState.current.stageId;
    if (stageId === stageIdTracker.current) return;
    const opened = resourceUrl(resources, sounds?.stageOpenedSoundResource);
    if (isDefined(stageId) && isDefined(opened)) playAudio(opened);
    stageIdTracker.current = stageId;
  }, [gameState, resources, sounds]);
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

/** One display component per render datum, for the given layer. */
const createDisplayComponents = (
  renderData: (GameDisplayRenderData | undefined)[] | undefined,
  layerHint: LayerHint,
  onAnswer: GameAnswerFunction,
): ReactNode[] | undefined =>
  renderData
    ?.filter(isDefined)
    .map((renderDatum) => (
      <GameDisplayComponent
        key={`${renderDatum.stageId}-${renderDatum.challengeId}-display-component`}
        render={renderDatum}
        layerHint={layerHint}
        onAnswer={onAnswer}
      />
    ));

/** Background and foreground nodes for the overview, stage, and challenge layers. */
const createLayers = (renderData: LayeredGameDisplayRenderData, onAnswer: GameAnswerFunction): GameLayers => {
  const layer = (data: (GameDisplayRenderData | undefined)[] | undefined) => ({
    backgroundLayerNodes: createDisplayComponents(data, "background", onAnswer),
    foregroundLayerNodes: createDisplayComponents(data, "foreground", onAnswer),
  });
  return {
    overview: layer([renderData.overviewRenderData]),
    stage: layer([renderData.stageRenderData]),
    challenges: layer(renderData.challengesRenderData),
  };
};

/** Whether a stylesheet URL is safe to load: `https:`, or on this site. */
function isAllowedStylesheet(href: string): boolean {
  const url = new URL(href, location.href);
  return url.protocol === "https:" || url.origin === location.origin;
}

/** Loads the stylesheets the game names, skipping (with a warning) any that are missing or not allowed. */
function GameStylesheets() {
  const { resources } = useGameData();
  const { gameState } = useGameState();
  return (gameState.gameData.stylesheets ?? []).flatMap((key) => {
    const href = resources[key];
    if (!isDefined(href) || !isAllowedStylesheet(href)) {
      console.warn(`Skipping stylesheet "${key}": ${href ?? "no such resource"}`);
      return [];
    }
    return <link key={key} rel="stylesheet" href={href} precedence="game" />;
  });
}

/**
 * The game itself: builds layered render data from the game state, and hands it to {@link GameLayersLayout}
 * along with the click handling, feedback (music, sound effects, rewards) and title screen keys.
 */
export default function Game() {
  const { debug } = useFeatureFlags();
  const { resources } = useGameData();
  const { gameState, setGameState } = useGameState();
  useGameFeedback();
  useTitleScreenKeys();

  /**
   * The callback function used when an answer is submitted (or tested) by a display component.
   * Accepts the answer, and if correct, updates the game state to complete the challenge.
   *
   * @returns true if the answer is correct (ie. the challenge is completed), or an array of validations.
   *
   * NB. Not all incorrect answers result in validations.
   * An empty array of validation also indicates an incorrect answer.
   */
  const onAnswer: GameAnswerFunction = useCallback(
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

  const layers = useMemo(
    () => createLayers(getLayeredRenderData(gameState, resources), onAnswer),
    [gameState, onAnswer, resources],
  );

  const handleElementClick = (_layerId: string, elementId: string) => {
    const newState = getNewGameStateForClick(gameState, elementId);
    if (!isDefined(newState)) return false;
    setGameState(newState);
    return true;
  };

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
      <GameLayersLayout
        debug={debug}
        gameLayers={layers}
        cameraLayer={gameState.gameData.modules?.camera}
        onElementClick={handleElementClick}
      />
    </div>
  );
}
