import type { GameRepository } from "./GameRepository";

export type GameSourceType = "RemoteRepository" | "LocalRepository" | "RawRepository";

export type GameSource = RemoteGameSource | LocalGameSource | RawGameSource;

export interface GameSourceBase {
  type: GameSourceType;
}

export interface RemoteGameSource extends GameSourceBase {
  type: "RemoteRepository";
  src: URL;
}

export interface LocalGameSource extends GameSourceBase {
  type: "LocalRepository";
  path: string;
}

export interface RawGameSource extends GameSourceBase {
  type: "RawRepository";
  repository: GameRepository;
}
