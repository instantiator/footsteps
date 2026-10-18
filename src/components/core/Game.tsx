import _ from "lodash";
import { useReward } from "partycles";
import { useCallback, useEffect, useState } from "react";
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
import { getLayeredRenderData, type GameDisplayRenderData } from "./logic/RenderDataUtils";
import { playAudio } from "./sfx/AudioUtils";

export type GameAnswerFunction = (
  stageId: GameStageId,
  challengeId: GameChallengeId,
  answer: string,
) => GameChallengeAnswerValidation[] | true;

export default function Game() {
  const { debug } = useFeatureFlags();
  const { resources } = useGameData();
  const { playMusic } = useGameMusic();

  // rendering
  const [layers, setLayers] = useState<GameLayers>({});

  // tracking
  const { gameState, setGameState } = useGameState();
  const [progressTracker, setProgressTracker] = useState<GameStageId[]>([]);
  const [overviewTracker, setOverviewTracker] = useState<GameOverviewDisplayPurpose | null>(null);
  const [stageIdTracker, setStageIdTracker] = useState<GameStageId | null>(null);

  // animation and sound
  const { reward } = useReward("reward-element", "fireworks", {
    particleCount: 200,
  });

  /** Whenever the game state changes, check for and reward completed stages */
  useEffect(() => {
    const newProgress = gameState.stages.filter((s) => s.completion === "completed").map((s) => s.stage.id);
    if (!_.isEqual(newProgress, progressTracker)) {
      reward();
      playAudio(sfxSuccess);
      setProgressTracker(newProgress);
    }
  }, [gameState, reward, progressTracker]);

  /** Play music when switching to the game-overview-stages, and game-overview-complete */
  useEffect(() => {
    // Play music on overview display change
    if (gameState.current.overviewDisplay !== overviewTracker) {
      if (gameState.current.overviewDisplay === "game-overview-stages") {
        playMusic(musicOpening);
      }
      if (gameState.current.overviewDisplay === "game-overview-complete") {
        playMusic(musicClosing);
      }
      setOverviewTracker(gameState.current.overviewDisplay);
    }
  }, [gameState, overviewTracker, playMusic]);

  /** Play a sound effect when switching stages */
  useEffect(() => {
    if (gameState.current.stageId !== stageIdTracker) {
      if (isDefined(gameState.current.stageId)) {
        playAudio(sfxMagicalEvent);
      }
      setStageIdTracker(gameState.current.stageId);
    }
  }, [gameState, stageIdTracker]);

  /**
   * The callback function used when an answer is submitted (or tested) by a display component.
   * Accepts the answer, and if correct, updates the game state to complete the challenge.
   *
   * @param stageId The ID of the stage containing the challenge being answered
   * @param challengeId The ID of the challenge being answered
   * @param answer The answer string being submitted
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

      const challenge = challengeState.challenge;
      const validations = validateAnswer(challenge, answer);

      if (validations !== true) {
        return validations;
      }

      // complete the challenge and update the game state
      const newGameState = completeChallenge(gameState, stageId, challengeId);
      setGameState(newGameState);

      return true;
    },
    [gameState, setGameState],
  );

  /** Set the display layers whenever the game state changes */
  useEffect(() => {
    const createDisplayComponents = (
      renderData: (GameDisplayRenderData | undefined)[] | undefined,
      layerHint: LayerHint,
    ) =>
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

    const renderData = getLayeredRenderData(gameState, resources);
    setLayers({
      overview: {
        backgroundLayerNodes: createDisplayComponents([renderData.overviewRenderData], "background"),
        foregroundLayerNodes: createDisplayComponents([renderData.overviewRenderData], "foreground"),
      },
      stage: {
        backgroundLayerNodes: createDisplayComponents([renderData.stageRenderData], "background"),
        foregroundLayerNodes: createDisplayComponents([renderData.stageRenderData], "foreground"),
      },
      challenges: {
        backgroundLayerNodes: createDisplayComponents(renderData.challengesRenderData, "background"),
        foregroundLayerNodes: createDisplayComponents(renderData.challengesRenderData, "foreground"),
      },
    });
  }, [gameState, onAnswer, resources, setGameState]);

  const handleElementClick = (layerId: string, elementId: string) => {
    console.debug(`Element ${elementId} on layer ${layerId} clicked.`);
    const newState = getNewGameStateForClick(gameState, layerId, elementId);
    if (isDefined(newState)) {
      console.debug("Updating game state from click.", newState);
      setGameState(newState);
      return true;
    } else {
      return false;
    }
  };

  return (
    <>
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
    </>
  );
}
