import type { GameData } from "../../src/entities/data/GameData";
import type { GameRepository } from "../../src/entities/GameRepository";

/** Id of {@link smallGame} in {@link smallRepository}. */
export const SMALL_GAME_ID = "small-game";

/**
 * A two-stage game with embedded templates only: a stages overview whose links enter each stage,
 * and one scroll challenge per stage that is answered by typing "custard" or "trifle".
 */
export const smallGame: GameData = {
  title: "Small Game",
  config: { sequential: true, autoAdvanceStages: false },
  gameContainerStyle: {},
  resources: {
    "still-image": { type: "local", target: "games/magic-trifle/tape-still.png" },
    "motion-image": { type: "local", target: "games/magic-trifle/tape-motion.gif" },
    sound: { type: "local", target: "games/magic-trifle/bells.mp3" },
  },
  displays: [
    {
      purpose: "game-overview-stages",
      clickIdToStageId: { "stage-link-stage-1": "stage-1", "stage-link-stage-2": "stage-2" },
      component: {
        type: "template",
        data: {},
        foregroundTemplate: {
          sourceType: "embedded",
          content:
            '<h1>{{gameState.gameData.title}}</h1>{{#gameState.stages}}<span id="stage-link-{{stage.id}}" role="button" tabindex="0">Stage {{oneIndex}}</span>{{/gameState.stages}}',
        },
      },
    },
  ],
  stages: ["stage-1", "stage-2"].map((stageId, index) => ({
    id: stageId,
    challenges: [
      {
        id: `${stageId}-challenge`,
        solution: { answers: [index === 0 ? "custard" : "trifle"], hints: [] },
        displays: [
          {
            purpose: "challenge-in-progress",
            component: {
              type: "scroll",
              data: {},
              contents: [{ text: `Question for ${stageId}`, showInput: true, label: "Your answer" }],
            },
          },
        ],
      },
    ],
  })),
};

/** A repository holding only {@link smallGame}. */
export const smallRepository: GameRepository = { games: { [SMALL_GAME_ID]: smallGame } };
