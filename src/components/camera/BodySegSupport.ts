import * as bodySeg from "@tensorflow-models/body-segmentation";
import bodyPartData from "./../../assets/body-seg-parts.json";

import type {
  Color,
  Segmentation,
} from "@tensorflow-models/body-segmentation/dist/shared/calculators/interfaces/common_interfaces";

/** A body part that the segmentation model can label, and how to show it. */
export interface BodyPartData {
  /** The value the segmentation mask holds for pixels of this body part. */
  maskValue: number;
  /** The colour used for this body part in a coloured mask. */
  color: Color;
  /** Human-readable name of the body part, for the colour key. */
  description: string;
}

/** The body parts the model distinguishes, by name, from `body-seg-parts.json`. */
export const BODY_PARTS: Record<string, BodyPartData> = bodyPartData;

/**
 * The colour a mask value is drawn in for the given mask type; transparent for unknown values, and for
 * anything but hands and feet when the type is "extremities".
 */
export function maskValueToColor(maskValue: number, maskType: "binary" | "colored" | "extremities"): Color {
  if (maskType === "extremities") {
    const isHandOrFoot =
      maskValue === BODY_PARTS.RIGHT_FOOT.maskValue ||
      maskValue === BODY_PARTS.LEFT_FOOT.maskValue ||
      maskValue === BODY_PARTS.RIGHT_HAND.maskValue ||
      maskValue === BODY_PARTS.LEFT_HAND.maskValue;
    if (!isHandOrFoot) {
      return { r: 0, g: 0, b: 0, a: 0 }; // Transparent
    }
  }

  return (
    Object.entries(BODY_PARTS).find(([, part]) => part.maskValue === maskValue)?.[1].color ?? { r: 0, g: 0, b: 0, a: 0 }
  );
}

/**
 * Draws the player's silhouette from the video onto the canvas, according to the mask type:
 * "binary" is the silhouette alone, "colored" tints it by body part, and "extremities" tints only hands and feet.
 */
export const drawMask = async (
  video: HTMLVideoElement | null,
  segmentation: Segmentation[],
  ctx: CanvasRenderingContext2D,
  maskType: "binary" | "colored" | "extremities",
) => {
  if (!video) return;
  const canvas = ctx.canvas;

  // For all modes, we start by drawing the person's silhouette from the video.
  const backgroundColor = { r: 0, g: 0, b: 0, a: 0 }; // Transparent
  const foregroundColor = { r: 0, g: 0, b: 0, a: 255 }; // Opaque black
  const binaryMask = await bodySeg.toBinaryMask(segmentation, foregroundColor, backgroundColor);
  const binaryMaskBitmap = await createImageBitmap(binaryMask);

  ctx.save();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(binaryMaskBitmap, 0, 0, canvas.width, canvas.height);

  // If we're in binary mode, we're done.
  if (maskType === "binary") {
    ctx.restore();
    return;
  }

  // For "colored" and "extremities", we now generate and overlay the colored mask.
  const coloredMask = await bodySeg.toColoredMask(
    segmentation,
    (value) => maskValueToColor(value, maskType),
    backgroundColor,
  );
  const coloredMaskBitmap = await createImageBitmap(coloredMask);

  // Use the 'color' blend mode to apply the hue and saturation from the mask
  // to the luminosity of the underlying video silhouette.
  ctx.globalCompositeOperation = "color";
  ctx.drawImage(coloredMaskBitmap, 0, 0, canvas.width, canvas.height);

  ctx.restore();
};
