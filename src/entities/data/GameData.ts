import type { CSSProperties } from "react";
import type { GameOverviewDisplay } from "./displays/GameDisplayData";
import type { CameraModuleData } from "./GameModuleData";
import type { GameStageData } from "./GameStageData";

/** Unique identifier for a game within a repository. */
export type GameId = string;

/** A game's authored definition: its overview displays, stages, challenges, resources and settings. */
export interface GameData {
  /** Name of the game, shown to players when choosing a game. */
  title: string;
  /** Overview displays (title, stages, complete), shown when no stage is active. */
  displays: GameOverviewDisplay[];
  /** The stages of the game, in order. */
  stages: GameStageData[];
  /** Named media resources, referenced by `*Resource` keys and passed to templates as `resources`. */
  resources?: GameResourceDefinitions;
  /** Optional modules to switch on for this game. */
  modules?: {
    /** Layers the player's camera view into the game. */
    camera?: CameraModuleData;
  };
  /** Game-wide behaviour settings. */
  config?: {
    /** If true (the default when `config` is omitted), each stage unlocks only after the previous one is completed. */
    sequential: boolean;
    /**
     * Whether to move on to the next stage automatically on completion.
     * Not yet implemented: never read. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #3.
     */
    autoAdvanceStages: boolean;
  };
  /** CSS applied to the element containing the whole game, e.g. fonts, colours and sizing. */
  gameContainerStyle: CSSProperties;
}

/**
 * Named resources, keyed by the name used to refer to them.
 * Resolved to absolute URLs when the game loads.
 */
export interface GameResourceDefinitions {
  [key: string]: {
    /** `local`: path on this site. `relative`: relative to the repository's location. `url`: absolute URL used as-is. */
    type: "local" | "relative" | "url";
    /** The path or URL, interpreted according to `type`. */
    target: string;
  };
}
