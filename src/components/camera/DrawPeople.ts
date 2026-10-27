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

/**
 * RGBA pixels, opaque wherever anyone is (or as opaque as a held person is), for cutting the people out of the video.
 * @param pixels a buffer to fill, reused between frames; a new one if omitted
 */
export const silhouettePixels = (
  { width, height, people }: VisionFrame,
  pixels: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(width * height * 4),
): Uint8ClampedArray<ArrayBuffer> => {
  pixels.fill(0);
  for (const { mask, held } of people) {
    const alpha = Math.round(255 * (held?.opacity ?? 1));
    for (let i = 0; i < mask.length; i++) if (mask[i] === 1) pixels[i * 4 + 3] = Math.max(pixels[i * 4 + 3], alpha);
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
 * @param pixels a buffer to fill, reused between frames; a new one if omitted
 */
export const tintPixels = (
  frame: VisionFrame,
  maskType: Exclude<MaskType, "binary">,
  pixels: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(frame.width * frame.height * 4),
): Uint8ClampedArray<ArrayBuffer> => {
  const { width, height, people } = frame;
  pixels.fill(0);
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

/** How the people are drawn. */
export interface DrawStyle {
  /** How the silhouette is tinted. */
  maskType: MaskType;
  /** How far the silhouette's edges fade out, in canvas pixels; 0 for hard edges. */
  featherPx: number;
}

/** A mask-sized canvas and the pixels drawn onto it, kept for each drawing context so every frame reuses them. */
interface MaskSurface {
  context: OffscreenCanvasRenderingContext2D;
  image: ImageData;
}

const surfaces = new WeakMap<CanvasRenderingContext2D, MaskSurface>();

/** The context's mask surface at the frame's size, made (or remade, when the size changes) as needed. */
const surfaceFor = (ctx: CanvasRenderingContext2D, { width, height }: VisionFrame): MaskSurface | null => {
  const existing = surfaces.get(ctx);
  if (existing?.image.width === width && existing.image.height === height) return existing;
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) return null;
  const surface = { context, image: context.createImageData(width, height) };
  surfaces.set(ctx, surface);
  return surface;
};

/** Draws the surface's pixels, scaled up onto the canvas. */
const drawSurface = (ctx: CanvasRenderingContext2D, { context, image }: MaskSurface) => {
  context.putImageData(image, 0, 0);
  ctx.drawImage(context.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
};

/**
 * Draws the people from the video onto the canvas, cut out by their silhouettes, and tints them for debugging
 * unless the mask type is "binary".
 */
export const drawPeople = (
  video: HTMLVideoElement,
  frame: VisionFrame,
  ctx: CanvasRenderingContext2D,
  { maskType, featherPx }: DrawStyle,
) => {
  const { canvas } = ctx;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const surface = frame.people.length > 0 && frame.width > 0 && frame.height > 0 ? surfaceFor(ctx, frame) : null;
  if (!surface) return ctx.restore();

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-in";
  // Blurring the mask as it scales up softens the edges it cuts, on the GPU
  if (featherPx > 0) ctx.filter = `blur(${featherPx}px)`;
  silhouettePixels(frame, surface.image.data);
  drawSurface(ctx, surface);
  ctx.filter = "none";
  if (maskType !== "binary") {
    // The tint's hue and saturation over the video's luminosity
    ctx.globalCompositeOperation = "color";
    tintPixels(frame, maskType, surface.image.data);
    drawSurface(ctx, surface);
  }
  ctx.restore();
};
