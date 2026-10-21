import type { CSSProperties } from "react";
import type { GameOverviewDisplay } from "./displays/GameDisplayData";
import type { CameraModuleData } from "./GameModuleData";
import type { GameStageData } from "./GameStageData";

/** Unique identifier for a game within a repository. */
export type GameId = string;

/**
 * The partycles animations a reward can use. Declared here rather than imported from partycles
 * because the schema generator can't resolve that package; keep in step with its `AnimationType`.
 */
export type RewardAnimation =
  | "confetti"
  | "sparkles"
  | "fireworks"
  | "hearts"
  | "stars"
  | "bubbles"
  | "snow"
  | "emoji"
  | "coins"
  | "petals"
  | "aurora"
  | "fireflies"
  | "paint"
  | "balloons"
  | "galaxy"
  | "leaves"
  | "glitch"
  | "magicdust"
  | "crystals"
  | "mortar"
  | "bokeh"
  | "ribbons"
  | "geometric";

/** A game's authored definition: its overview displays, stages, challenges, resources and settings. */
export interface GameData {
  /** Name of the game, shown to players when choosing a game. */
  title: string;
  /** One-line description, shown on the game's tile on the landing page. */
  description: string;
  /** Resource name (a key of `resources`) of the image shown behind the game's landing-page tile. */
  tileGraphic?: string;
  /** Overview displays (title, stages, complete), shown when no stage is active. */
  displays: GameOverviewDisplay[];
  /** The stages of the game, in order. */
  stages: GameStageData[];
  /** Named media resources, referenced by `*Resource` keys and passed to templates as `resources`. */
  resources?: GameResourceDefinitions;
  /**
   * Names of resources (keys of `resources`) that are CSS stylesheets the game needs, such as a web font;
   * loaded while the game is shown. Only `https:` or same-site URLs are used.
   */
  stylesheets?: string[];
  /** Music and sound effects, as resource names (keys of `resources`). Any left unset is silent. */
  sounds?: {
    /** Music played when the stages overview shows. */
    openingMusicResource?: string;
    /** Music played on the game-complete overview. */
    closingMusicResource?: string;
    /** Sound effect played when a stage opens. */
    stageOpenedSoundResource?: string;
    /** Sound effect played when a stage is completed. */
    stageCompletedSoundResource?: string;
  };
  /** The celebration shown when a stage is completed. Unset means none. */
  reward?: {
    /** Which partycles animation to show. */
    animation: RewardAnimation;
    /** How many particles to launch (default 200). */
    particleCount?: number;
  };
  /** Credits for the third-party media this game uses, listed with the game on the landing page. */
  credits?: {
    /** What to show, e.g. the work's title and author. */
    text: string;
    /** Where to link the text to, if anywhere. */
    url?: string;
  }[];
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
