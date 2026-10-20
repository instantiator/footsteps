import type { GameRepository } from "./GameRepository";

/** Discriminator for the kinds of place a {@link GameRepository} can be loaded from. */
export type GameSourceType = "RemoteRepository" | "LocalRepository" | "RawRepository";

/** Where a game repository is loaded from. */
export type GameSource = RemoteGameSource | LocalGameSource | RawGameSource;

/** Fields common to every kind of {@link GameSource}. */
export interface GameSourceBase {
  /** Which kind of source this is. */
  type: GameSourceType;
}

/** A repository fetched from an absolute URL. */
export interface RemoteGameSource extends GameSourceBase {
  type: "RemoteRepository";
  /** URL of the repository JSON file. Relative paths resolve against its directory. */
  src: URL;
}

/** A repository served from this site. */
export interface LocalGameSource extends GameSourceBase {
  type: "LocalRepository";
  /** Path under this site's base URL. Relative paths resolve against the site. */
  path: string;
}

/** An in-memory repository. It has no location, so cannot use relative paths. */
export interface RawGameSource extends GameSourceBase {
  type: "RawRepository";
  /** The repository itself. */
  repository: GameRepository;
}
