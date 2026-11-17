/**
 * How spectators, people the camera sees standing off a 2.5D scene's floor, are shown. They never play: they have no
 * interactions, positions or count, but keep their player number for when they step back on. A narrower scene's
 * setting overrides a broader one's key by key.
 */
export interface GameSpectatorsData {
  /** Whether spectators are drawn. Defaults to `hidden`. */
  show?: "hidden" | "shown";
  /** How a shown spectator looks, at full strength. Without it, they look like a player. */
  look?: GameSpectatorLook;
  /**
   * How the look's strength follows how far outside the floor a spectator stands, in floor units: none at `from`
   * (defaults to the spectator margin, 5), full at `to`, eased between. Without it, the look is at full strength.
   */
  fade?: GameSpectatorFade;
  /**
   * Whether this scene's challenge resets when a spectator steps back on the floor far from where they left it, so
   * walking round the outside can't skip part of it. Defaults to false.
   */
  resetOnReturn?: boolean;
}

/** Where a spectator's look fades in, in floor units outside the floor. */
export interface GameSpectatorFade {
  /** Where it starts, at no strength. Defaults to the spectator margin, 5. */
  from?: number;
  /** Where it reaches full strength. */
  to: number;
}

/** How a shown spectator looks, at full strength. */
export interface GameSpectatorLook {
  /** Their opacity, 0–1. */
  opacity?: number;
  /**
   * A CSS filter, eg. `grayscale(1)`. `--spectator-strength` (0–1) is set beside it, so it can follow the fade:
   * `grayscale(calc(var(--spectator-strength) * 100%))`.
   */
  filter?: string;
  /** The proportion of their image made static, 0–1, as `player-static` does. */
  static?: number;
}
