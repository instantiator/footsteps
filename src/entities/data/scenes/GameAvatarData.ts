/**
 * What stands in for the player. `mouse`: clicks and mouse moves. `camera`: the player's camera cut-out.
 * `mouse-feet`: as `mouse`, but the pointer is also player 1's feet: moving over elements fires foot interactions, and
 * a drag is a jump from where it starts to where it ends.
 */
export type GameAvatarMode = "mouse" | "camera" | "mouse-feet";

/**
 * Avatar settings for one scene. `mode` and `fallback` go together: a scene that sets `mode` doesn't inherit a broader
 * scene's `fallback`. `preview` and `feet` inherit on their own.
 */
export interface GameSceneAvatarData {
  /** What stands in for the player while this scene shows. */
  mode?: GameAvatarMode;
  /** The mode to use when the camera isn't available. Leaving it out of a `camera` mode means the camera is required. */
  fallback?: Exclude<GameAvatarMode, "camera">;
  /** Whether the webcam preview shows while this scene shows; only in `camera` mode. */
  preview?: boolean;
  /** How the pointer's feet look in `mouse-feet` mode, including as a fallback. */
  feet?: GameAvatarFeetData;
}

/**
 * How the pointer's feet look in `mouse-feet` mode, and how much of a target they must cover. A narrower scene's
 * setting overrides a broader one's key by key.
 */
export interface GameAvatarFeetData {
  /**
   * The footprint's diameter, in floor units (a hundredth of the floor's width at its front, or of a 2D scene's).
   * A rule's `threshold` is the share of the footprint that must be over its element. Defaults to 6.
   */
  size?: number;
  /** The footprint's CSS colour. Defaults to a translucent white. */
  color?: string;
  /** An image resource drawn upright, standing on the footprint, instead of the plain footprint. */
  imageResource?: string;
  /** Whether the mouse pointer shows over the game while the feet do. Defaults to `shown`. */
  pointer?: "shown" | "hidden";
}
