import { GameOverviewPurposeSequence } from "../../components/core/logic/GameClickUtils";
import { isDefined } from "../../util/ObjectUtils";
import type { GameOverviewDisplayPurpose } from "../data/displays/GameDisplayData";
import type { GameData } from "../data/GameData";
import type { GameStageId } from "../data/GameStageData";
import type { GameStageState } from "./GameStageState";

export interface GameState {
  gameData: GameData;
  stages: GameStageState[];
  current: {
    stageId: GameStageId | null;
    overviewDisplay: GameOverviewDisplayPurpose | null;
  };
}

export function createBlankGameState(game: GameData): GameState {
  const stages: GameStageState[] = game.stages.map((stage, index) => ({
    stage: stage,
    availability: (game.config?.sequential ?? true) ? (index === 0 ? "unlocked" : "locked") : "unlocked",
    completion: "ready",
    challengeStates: stage.challenges.map((challenge) => ({
      challenge: challenge,
      displayPurpose: null,
      attempts: [],
      succeeded: false,
    })),
  }));

  const overviewDisplay = GameOverviewPurposeSequence.find((purpose) =>
    game.displays.some((d) => purpose === d.purpose),
  );
  if (!isDefined(overviewDisplay)) {
    throw new Error(`No initial overview display found, from: ${GameOverviewPurposeSequence.join(", ")}`);
  }

  return {
    gameData: game,
    stages: stages,
    current: {
      stageId: null,
      overviewDisplay,
    },
  };
}
