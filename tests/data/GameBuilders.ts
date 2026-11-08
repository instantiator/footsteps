import type { GameChallengeData } from "../../src/entities/data/GameChallengeData";
import type { GameData } from "../../src/entities/data/GameData";
import type { GameStageData } from "../../src/entities/data/GameStageData";
import type { GameChallengeScenePurpose, GameScenePurpose } from "../../src/entities/data/scenes/GameSceneData";

/** A minimal scroll component; `marker` is passed through as its `data`, to tell displays apart. */
export const scroll = (marker: string = "") => ({
  type: "scroll" as const,
  contents: [],
  data: { marker },
});

/** A display of the given purpose, in the shape every display level shares. */
export const display = <P extends GameScenePurpose>(purpose: P, marker?: string) => ({
  purpose,
  component: scroll(marker ?? purpose),
});

/** A challenge answered by "ANSWER", with the given display purposes. */
export const challenge = (
  id: string,
  purposes: GameChallengeScenePurpose[] = ["challenge-in-progress"],
): GameChallengeData => ({
  id,
  scenes: purposes.map((p) => display(p)),
  solution: { answers: ["ANSWER"] },
});

/** A stage with the given challenges. */
export const stage = (
  id: string,
  challenges: GameChallengeData[],
  extra: Partial<GameStageData> = {},
): GameStageData => ({ id, challenges, ...extra });

/** A game with the given overview display purposes and stages. */
export const game = (
  overviews: ("game-overview-title" | "game-overview-stages" | "game-overview-complete")[],
  stages: GameStageData[],
  config?: GameData["config"],
): GameData => ({
  title: "Test Game",
  description: "A game for tests.",
  scenes: overviews.map((p) => display(p)),
  stages,
  config,
  gameContainerStyle: {},
});
