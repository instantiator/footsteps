import _ from "lodash";
import { useReward } from "partycles";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import sfxMagicalEvent from "../../assets/resources/magical-event.m4a";
import musicOpening from "../../assets/resources/music-1.mp3";
import musicClosing from "../../assets/resources/music-2.mp3";
import sfxSuccess from "../../assets/resources/win-sound.mp3";
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
import { getNewGameStateForClick } from "./logic/GameClickUtils";
import { findChallengeState } from "./logic/GameDataUtils";
import { completeChallenge, validateAnswer } from "./logic/GameStateUtils";
import {
  getLayeredRenderData,
  type GameDisplayRenderData,
  type LayeredGameDisplayRenderData,
} from "./logic/RenderDataUtils";
import { playAudio } from "./sfx/AudioUtils";

export type GameAnswerFunction = (
  stageId: GameStageId,
  challengeId: GameChallengeId,
  answer: string,
) => GameChallengeAnswerValidation[] | true;

/** Rewards completed stages, and plays music and sound effects as the player moves around the game. */
function useGameFeedback() {
  const { gameState } = useGameState();
  const { playMusic } = useGameMusic();
  const { reward } = useReward("reward-element", "fireworks", { particleCount: 200 });

  // Previous values, to react only to changes; refs because nothing renders from them
  const progressTracker = useRef<GameStageId[]>([]);
  const overviewTracker = useRef<GameOverviewDisplayPurpose | null>(null);
  const stageIdTracker = useRef<GameStageId | null>(null);

  useEffect(() => {
    const newProgress = gameState.stages.filter((s) => s.completion === "completed").map((s) => s.stage.id);
    if (!_.isEqual(newProgress, progressTracker.current)) {
      reward();
      playAudio(sfxSuccess);
      progressTracker.current = newProgress;
    }
  }, [gameState, reward]);

  useEffect(() => {
    const overviewDisplay = gameState.current.overviewDisplay;
    if (overviewDisplay === overviewTracker.current) return;
    if (overviewDisplay === "game-overview-stages") playMusic(musicOpening);
    if (overviewDisplay === "game-overview-complete") playMusic(musicClosing);
    overviewTracker.current = overviewDisplay;
  }, [gameState, playMusic]);

  useEffect(() => {
    const stageId = gameState.current.stageId;
    if (stageId === stageIdTracker.current) return;
    if (isDefined(stageId)) playAudio(sfxMagicalEvent);
    stageIdTracker.current = stageId;
  }, [gameState]);
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

export default function Game() {
  const { debug } = useFeatureFlags();
  const { resources } = useGameData();
  const { gameState, setGameState } = useGameState();
  useGameFeedback();

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

  const handleElementClick = (layerId: string, elementId: string) => {
    console.debug(`Element ${elementId} on layer ${layerId} clicked.`);
    const newState = getNewGameStateForClick(gameState, elementId);
    if (!isDefined(newState)) return false;
    console.debug("Updating game state from click.", newState);
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
