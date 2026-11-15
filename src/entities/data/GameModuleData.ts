import type { GameSceneAvatarData, GameSceneMode } from "./scenes/GameSceneData";
import type { GameSpectatorsData } from "./scenes/GameSpectatorsData";

/** Game-wide settings, which any scene can override. */
export interface GameModulesData {
  /** How scenes are laid out, unless a scene says otherwise. Defaults to `2D`. */
  scene?: GameSceneMode;
  /** What stands in for the player, unless a scene says otherwise. Defaults to `mouse`. */
  avatar?: GameSceneAvatarData;
  /** How spectators, people standing off a 2.5D scene's floor, are shown, unless a scene says otherwise. */
  spectators?: GameSpectatorsData;
}
