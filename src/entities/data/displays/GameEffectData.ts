import type { GameActionBase } from "./GameDisplayData";

/** How long an effect runs: milliseconds, or `"indefinite"` to carry on until stopped or its display ends. */
export type GameEffectDuration = number | "indefinite";

/** Who a player effect applies to: the player who fired the rule, or every active player. */
export type GamePlayerChoice = "triggering" | "all";

/** What every effect on elements can have. */
export interface GameItemEffectBase extends GameActionBase {
  /** CSS selector for the elements. Defaults to every item in the shown displays. */
  target?: string;
  /** How long it runs. */
  durationMs?: GameEffectDuration;
  /**
   * The length of one loop, when `durationMs` is `"indefinite"`.
   *
   * @minimum 0
   */
  cycleMs?: number;
  /** A CSS easing function: how it speeds up and slows down. */
  easing?: string;
}

/** What every effect on players can have. */
export interface GamePlayerEffectBase extends GameActionBase {
  /** Who it applies to. Defaults to `"triggering"`. */
  players?: GamePlayerChoice;
  /** How long it takes. */
  durationMs?: GameEffectDuration;
  /** A CSS easing function: how it speeds up and slows down. */
  easing?: string;
}

/** Shakes elements. Moves each item, never a layer's container, so items can still sort among players. */
export interface GameQuakeEffect extends GameItemEffectBase {
  /** Which effect this is. */
  effect: "quake";
  /** How far to shake horizontally, as a % of the display's width. Defaults to 0. */
  dx?: number;
  /** How far to shake vertically, as a % of the display's height. Defaults to 0. */
  dy?: number;
  /** Whether all the items shake with the same motion. If false, each item's motion is random. Defaults to true. */
  consistentMotion?: boolean;
}

/** Drops elements off the bottom of the display, where they stay until it resets. */
export interface GameItemFallEffect extends GameItemEffectBase {
  /** Which effect this is. */
  effect: "item-fall";
}

/** A place in the display: the element's centre, as % of the display's width and height. */
export interface GamePositionInDisplay {
  /** % of the display's width, from the left. */
  left: number;
  /** % of the display's height, from the top. */
  top: number;
}

/** An amount from where the element is when the effect starts. */
export interface GamePositionByAmount {
  /** The amount, as % of the display's width and height. */
  by: GamePositionInDisplay;
}

/** An amount from the centre of another element. */
export interface GamePositionFromElement extends GamePositionInDisplay {
  /** CSS selector for the other element. */
  from: string;
}

/** Where an element goes; see the coordinate system in `docs/special-effects.md`. */
export type GameEffectPosition = GamePositionInDisplay | GamePositionByAmount | GamePositionFromElement;

/** Moves elements, where they stay until their display resets. */
export interface GameItemMoveEffect extends GameItemEffectBase {
  /** Which effect this is. */
  effect: "item-move";
  /** Where the move begins. Defaults to where the element is now. */
  start?: GameEffectPosition;
  /** Where the move ends. */
  end: GameEffectPosition;
}

/** One step of a highlight. */
export interface GameHighlightStep {
  /** A CSS `filter`. */
  filter?: string;
  /** A CSS `box-shadow`. */
  shadow?: string;
  /** A CSS `outline`. */
  outline?: string;
  /**
   * How long the step takes. Defaults to 1000.
   *
   * @minimum 0
   */
  durationMs?: number;
  /** A CSS easing function: how the step's styles build. Without one, they apply at full strength throughout. */
  easing?: string;
}

/** Plays a series of styles on elements, which then return to their own styles. */
export interface GameHighlightEffect extends Omit<GameItemEffectBase, "cycleMs" | "easing"> {
  /** Which effect this is. */
  effect: "highlight";
  /** The styles, in order. */
  sequence: GameHighlightStep[];
}

/** Drops players off the display. They are removed once they have gone. */
export interface GamePlayerFallEffect extends GamePlayerEffectBase {
  /** Which effect this is. */
  effect: "player-fall";
}

/** The range of directions a player spinning away may leave in. */
export interface GameEffectAngle {
  /** Degrees on screen: 0 is straight up, 90 is right, and -90 is left. */
  min: number;
  /** Degrees on screen, as for `min`. */
  max: number;
}

/** Knocks players off the display, turning as they go. They are removed once they have gone. */
export interface GamePlayerSpinAwayEffect extends GamePlayerEffectBase {
  /** Which effect this is. */
  effect: "player-spin-away";
  /** The directions they may leave in; one is picked at random. Defaults to -60 to 60. */
  angle?: GameEffectAngle;
  /**
   * How much bigger or smaller they are by the time they are off-screen, as a multiple above 0. Defaults to 1.
   */
  zoom?: number;
  /**
   * How opaque they are by the time they are off-screen. Defaults to 1.
   *
   * @minimum 0
   * @maximum 1
   */
  opacity?: number;
  /** How many times they turn on the way. The direction is random. Defaults to 2. */
  rotations?: number;
}

/** Hides players, or shows them again. They are still active, and can still interact. */
export interface GamePlayerOpacityEffect extends GamePlayerEffectBase {
  /** Which effect this is. */
  effect: "player-invisible" | "player-visible";
}

/** Makes players look partly transparent, like a detuned TV. They are still active, and can still interact. */
export interface GamePlayerStaticEffect extends GamePlayerEffectBase {
  /** Which effect this is. */
  effect: "player-static";
  /**
   * The size of each block of static, as a % of the display's width, above 0. Defaults to 0.5.
   */
  pixelSize?: number;
  /**
   * The target proportion of the player's pixels made transparent. Defaults to 0.5.
   *
   * @minimum 0
   * @maximum 1
   */
  proportion?: number;
  /**
   * How long it takes to reach `proportion`, and to fade away again. Defaults to 500.
   *
   * @minimum 0
   */
  easeMs?: number;
}

/** Stops players in place until `player-unfreeze`. They are still active, but can't interact. Applies at once. */
export interface GamePlayerFreezeEffect extends GameActionBase {
  /** Which effect this is. */
  effect: "player-freeze";
  /** Who it applies to. Defaults to `"triggering"`. */
  players?: GamePlayerChoice;
}

/** Returns frozen players to the live camera. Applies at once. */
export interface GamePlayerUnfreezeEffect extends GameActionBase {
  /** Which effect this is. */
  effect: "player-unfreeze";
  /** Who it applies to. Defaults to `"triggering"`. */
  players?: GamePlayerChoice;
}

/** Returns players to normal, whatever has happened to them. `"all"` includes removed players. */
export interface GamePlayerRestoreEffect extends GameActionBase {
  /** Which effect this is. */
  effect: "player-restore";
  /** Who it applies to. Defaults to `"triggering"`. */
  players?: GamePlayerChoice;
  /** How long they take to fade back in. Defaults to 500. */
  durationMs?: GameEffectDuration;
}

/** Ends effects before their display does. An item returns to where its template puts it. */
export interface GameStopEffect extends GameActionBase {
  /** Which effect this is. */
  effect: "stop";
  /** CSS selector for the elements. Defaults to every item in the shown displays. */
  target?: string;
  /** The players to stop effects on, instead of `target`. */
  players?: GamePlayerChoice;
  /** The effect to stop. Defaults to all of them. */
  stop?: string;
}

/** An item effect, a player effect, or stopping one. */
export type GameEffect =
  | GameQuakeEffect
  | GameItemFallEffect
  | GameItemMoveEffect
  | GameHighlightEffect
  | GamePlayerFallEffect
  | GamePlayerSpinAwayEffect
  | GamePlayerOpacityEffect
  | GamePlayerStaticEffect
  | GamePlayerFreezeEffect
  | GamePlayerUnfreezeEffect
  | GamePlayerRestoreEffect
  | GameStopEffect;

/** The name of an effect. */
export type GameEffectName = GameEffect["effect"];

/** The name of every effect. */
export const GAME_EFFECT_NAMES = [
  "quake",
  "item-fall",
  "item-move",
  "highlight",
  "player-fall",
  "player-spin-away",
  "player-invisible",
  "player-visible",
  "player-static",
  "player-freeze",
  "player-unfreeze",
  "player-restore",
  "stop",
] as const satisfies readonly GameEffectName[];
