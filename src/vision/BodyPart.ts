/** The body parts the game tracks, whichever vision model is used. */
export const BodyPart = {
  /** The whole silhouette. */
  BODY: "body",
  /** The head, as the box its extremes span. */
  HEAD: "head",
  /** The person's own left hand. */
  LEFT_HAND: "leftHand",
  /** The person's own right hand. */
  RIGHT_HAND: "rightHand",
  /** The person's own left foot. */
  LEFT_FOOT: "leftFoot",
  /** The person's own right foot. */
  RIGHT_FOOT: "rightFoot",
} as const;

/** One of {@link BodyPart}'s values. */
export type BodyPart = (typeof BodyPart)[keyof typeof BodyPart];

/** An RGBA colour, each channel 0–255. */
export interface Color {
  /** Red. */
  r: number;
  /** Green. */
  g: number;
  /** Blue. */
  b: number;
  /** Alpha: 0 is transparent. */
  a: number;
}

/** Every body part, the whole silhouette first. */
export const BODY_PARTS = Object.values(BodyPart);
