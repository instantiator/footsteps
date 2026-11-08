import type { GameScenePagedComponentBase } from "./GameSceneDialogComponentData";

/** A dialog on the app's old-paper image: see {@link GameScenePagedComponentBase} for its fields. */
export interface GameSceneScrollComponentData extends GameScenePagedComponentBase {
  type: "scroll";
}
