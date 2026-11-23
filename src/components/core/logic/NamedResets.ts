import type { GameData } from "../../../entities/data/GameData";
import type { GameRepository } from "../../../entities/GameRepository";
import type { GameResetScene, GameSceneBase } from "../../../entities/data/scenes/GameSceneData";

/** A scene's reset scene, once names are resolved; a name left over is unknown, and has none. */
export const resetSceneOf = (scene: Pick<GameSceneBase, "resetScene">): GameResetScene | undefined =>
  typeof scene.resetScene === "string" ? undefined : scene.resetScene;

/** A scene with its reset scene's name replaced by the game's scene of that name, if it has one. */
const resolved = <T extends GameSceneBase>(scene: T, named: GameData["resetScenes"]): T => {
  const name = scene.resetScene;
  const reset = typeof name === "string" && Object.hasOwn(named ?? {}, name) ? named?.[name] : undefined;
  return reset === undefined ? scene : { ...scene, resetScene: reset };
};

/** A game with every reset scene named in its scenes replaced by the scene of that name; unknown names stay. */
export const resolveNamedResets = (game: GameData): GameData => {
  const named = game.resetScenes;
  if (named === undefined) return game;
  return {
    ...game,
    scenes: game.scenes.map((scene) => resolved(scene, named)),
    stages: game.stages.map((stage) => ({
      ...stage,
      scenes: stage.scenes?.map((scene) => resolved(scene, named)),
      challenges: stage.challenges.map((challenge) => ({
        ...challenge,
        scenes: challenge.scenes.map((scene) => resolved(scene, named)),
      })),
    })),
  };
};

/** A repository with each game's named reset scenes resolved. */
export const resolveRepositoryResets = (repository: GameRepository): GameRepository => ({
  ...repository,
  games: Object.fromEntries(Object.entries(repository.games).map(([id, game]) => [id, resolveNamedResets(game)])),
});

/** The reset scene names a game's scenes give that it has no reset scene for, with where each is. */
export const unknownResetNames = (game: GameData): string[] => {
  const where = (scene: GameSceneBase, path: string) =>
    typeof scene.resetScene === "string"
      ? [`${path}: there is no reset scene "${scene.resetScene}" in resetScenes`]
      : [];
  return [
    ...game.scenes.flatMap((scene, d) => where(scene, `scenes[${d}]`)),
    ...game.stages.flatMap((stage, s) => [
      ...(stage.scenes ?? []).flatMap((scene, d) => where(scene, `stages[${s}].scenes[${d}]`)),
      ...stage.challenges.flatMap((challenge, c) =>
        challenge.scenes.flatMap((scene, d) => where(scene, `stages[${s}].challenges[${c}].scenes[${d}]`)),
      ),
    ]),
  ];
};
