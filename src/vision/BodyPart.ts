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

/** How a body part is shown in debug views. */
export interface BodyPartStyle {
  /** The colour the part is tinted in. */
  color: Color;
  /** Human-readable name, for the colour key. */
  description: string;
}

/** Each body part's debug colour and name. */
export const BODY_PART_STYLES: Record<BodyPart, BodyPartStyle> = {
  body: { color: { r: 128, g: 128, b: 128, a: 255 }, description: "Body" },
  head: { color: { r: 255, g: 0, b: 0, a: 255 }, description: "Head" },
  leftHand: { color: { r: 0, g: 255, b: 0, a: 255 }, description: "Left hand" },
  rightHand: { color: { r: 0, g: 0, b: 255, a: 255 }, description: "Right hand" },
  leftFoot: { color: { r: 255, g: 255, b: 0, a: 255 }, description: "Left foot" },
  rightFoot: { color: { r: 255, g: 0, b: 255, a: 255 }, description: "Right foot" },
};

/** Every body part, the whole silhouette first. */
export const BODY_PARTS = Object.values(BodyPart);
