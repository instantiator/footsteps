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
