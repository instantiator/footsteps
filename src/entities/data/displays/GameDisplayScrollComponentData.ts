import type { GameDisplayPagedComponentBase } from "./GameDisplayDialogComponentData";

/** A dialog on the app's old-paper image: see {@link GameDisplayPagedComponentBase} for its fields. */
export interface GameDisplayScrollComponentData extends GameDisplayPagedComponentBase {
  type: "scroll";
}
