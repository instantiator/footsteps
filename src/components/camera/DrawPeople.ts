import { BODY_PART_STYLES, BodyPart, type Color } from "../../vision/BodyPart";
import { partRegion } from "../../vision/VisionQueries";
import type { VisionFrame } from "../../vision/VisionTypes";

/** How the silhouette is drawn: plain, tinted per person and part, or tinted at the hands and feet only. */
export type MaskType = "binary" | "colored" | "extremities";

/** Tints that tell people apart in a coloured mask, used in turn. */
const PERSON_TINTS: Color[] = [
  { r: 0, g: 160, b: 255, a: 255 },
  { r: 255, g: 140, b: 0, a: 255 },
  { r: 160, g: 0, b: 255, a: 255 },
  { r: 0, g: 200, b: 120, a: 255 },
];

/** The parts tinted in an "extremities" mask, and over the person's tint in a "colored" one. */
const TINTED_PARTS: BodyPart[] = [
  BodyPart.HEAD,
  BodyPart.LEFT_HAND,
  BodyPart.RIGHT_HAND,
  BodyPart.LEFT_FOOT,
  BodyPart.RIGHT_FOOT,
];

/** RGBA pixels, opaque wherever anyone is, for cutting the people out of the video. */
export const silhouettePixels = ({ width, height, people }: VisionFrame): Uint8ClampedArray<ArrayBuffer> => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const { mask } of people) {
    for (let i = 0; i < mask.length; i++) if (mask[i] === 1) pixels[i * 4 + 3] = 255;
  }
  return pixels;
};

/** Writes a colour to one pixel. */
const paint = (pixels: Uint8ClampedArray, i: number, { r, g, b, a }: Color) => {
  pixels.set([r, g, b, a], i * 4);
};

/**
 * RGBA pixels that tint the silhouette: each person in their own colour for "colored", then the head,
 * hands and feet in their part's colour; transparent elsewhere.
 */
export const tintPixels = (
  frame: VisionFrame,
  maskType: Exclude<MaskType, "binary">,
): Uint8ClampedArray<ArrayBuffer> => {
  const { width, height, people } = frame;
  const pixels = new Uint8ClampedArray(width * height * 4);
  people.forEach((person, index) => {
    const { mask } = person;
    if (maskType === "colored") {
      const tint = PERSON_TINTS[index % PERSON_TINTS.length];
      for (let i = 0; i < mask.length; i++) if (mask[i] === 1) paint(pixels, i, tint);
    }
    for (const part of TINTED_PARTS) {
      const region = partRegion(person, part, width, height);
      if (!region) continue;
      const { left, top, right, bottom } = region.bounds;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = y * width + x;
          if (mask[i] === 1 && region.contains(x, y)) paint(pixels, i, BODY_PART_STYLES[part].color);
        }
      }
    }
  });
  return pixels;
};

/** An image of the given pixels, scaled onto the canvas. */
const drawPixels = async (
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray<ArrayBuffer>,
  frame: VisionFrame,
) => {
  const bitmap = await createImageBitmap(new ImageData(pixels, frame.width, frame.height));
  ctx.drawImage(bitmap, 0, 0, ctx.canvas.width, ctx.canvas.height);
  bitmap.close();
};

/**
 * Draws the people from the video onto the canvas, cut out by their silhouettes, and tints them for debugging
 * unless the mask type is "binary".
 */
export const drawPeople = async (
  video: HTMLVideoElement,
  frame: VisionFrame,
  ctx: CanvasRenderingContext2D,
  maskType: MaskType,
) => {
  const { canvas } = ctx;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (frame.people.length === 0 || frame.width === 0 || frame.height === 0) return ctx.restore();

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-in";
  await drawPixels(ctx, silhouettePixels(frame), frame);
  if (maskType !== "binary") {
    // The tint's hue and saturation over the video's luminosity
    ctx.globalCompositeOperation = "color";
    await drawPixels(ctx, tintPixels(frame, maskType), frame);
  }
  ctx.restore();
};
