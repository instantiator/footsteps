import type { Point } from "../../../vision/VisionTypes";
import { rowLength, type FloorView, type MaskSize } from "../../camera/FloorGeometry";
import {
  floorAreaQuad,
  floorBackgroundSurface,
  HORIZON_DISTANCE,
  horizonSurface,
  matrix3dFor,
  screenSurface,
  uprightSurface,
  type Drawn,
  type FloorArea,
  type FloorSide,
} from "../../camera/FloorSurfaces";
import { DEPTH_STACK_CLASS, depthZIndex } from "../../camera/PlayerPosition";
import { FLOOR_AREA_ATTRIBUTE, SURFACE_CLASSES } from "./FloorSurfaceClasses";

/** A kind of floor surface: one of the classes, or a floor area. */
export type SurfaceKind = (typeof SURFACE_CLASSES)[number] | "floor-area";

/** The selector for every floor surface. */
export const SURFACE_SELECTOR = [`[${FLOOR_AREA_ATTRIBUTE}]`, ...SURFACE_CLASSES.map((name) => `.${name}`)].join(", ");

/** How far beyond the floor's edge a background stands when its distance isn't given, in floor units. */
export const BACKGROUND_DISTANCE = 50;

/** A floor surface, from its class or `data-floor-area`, and the attributes that shape it. */
export interface Surface {
  /** Which surface it is. */
  kind: SurfaceKind;
  /** The rectangle a floor area covers. */
  area?: FloorArea;
  /** How high an upright surface stands, in floor x units (`data-floor-height`); its box's shape sets it otherwise. */
  height?: number;
  /** How far beyond the floor's edge an upright surface stands, in floor units (`data-wall-distance`). */
  distance: number;
  /** How far below the floor the floor background lies, in floor x units (`data-floor-depth`). */
  depth: number;
  /** Whether an upright surface reaches the screen's top (`data-fill-height`). */
  fillHeight: boolean;
  /** Whether a rear or front surface reaches the screen's sides (`data-fill-width`). */
  fillWidth: boolean;
  /** Which end of a side surface reaches the top when it fills the height (`data-fill-edge`). */
  fillEdge: "near" | "far";
}

/** A finite number from game content, or undefined. */
export const numberOf = (value: string | null): number | undefined => {
  const parsed = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** A floor area's rectangle, from `"left back right front"`; undefined unless that is four numbers. */
export const parseFloorArea = (value: string | null): FloorArea | undefined => {
  const numbers = (value ?? "").trim().split(/\s+/).map(numberOf);
  if (numbers.length !== 4 || !numbers.every((number) => number !== undefined)) return undefined;
  const [left, back, right, front] = numbers;
  return {
    left: Math.min(left, right),
    back: Math.min(back, front),
    right: Math.max(left, right),
    front: Math.max(back, front),
  };
};

/** How far out a surface stands when its distance isn't given. */
const defaultDistance = (kind: SurfaceKind): number => {
  if (kind === "horizon-background" || kind === "floor-background") return HORIZON_DISTANCE;
  return kind.endsWith("-background") ? BACKGROUND_DISTANCE : 0;
};

/** An element's surface, which comes from game content; null if it isn't one, or its floor area is malformed. */
export const parseSurface = (element: Element): Surface | null => {
  const shape = {
    height: numberOf(element.getAttribute("data-floor-height")),
    depth: numberOf(element.getAttribute("data-floor-depth")) ?? 0,
    fillHeight: element.hasAttribute("data-fill-height"),
    fillWidth: element.hasAttribute("data-fill-width"),
    fillEdge: element.getAttribute("data-fill-edge") === "near" ? ("near" as const) : ("far" as const),
  };
  if (element.hasAttribute(FLOOR_AREA_ATTRIBUTE)) {
    const area = parseFloorArea(element.getAttribute(FLOOR_AREA_ATTRIBUTE));
    return area ? { kind: "floor-area", area, distance: 0, ...shape } : null;
  }
  const kind = SURFACE_CLASSES.find((name) => element.classList.contains(name));
  if (!kind) return null;
  return { kind, distance: numberOf(element.getAttribute("data-wall-distance")) ?? defaultDistance(kind), ...shape };
};

/** Every surface kind, back to front. */
const PAINT_ORDER: readonly SurfaceKind[] = [
  ...SURFACE_CLASSES.filter((kind) => kind.endsWith("-background")),
  "floor-area",
  ...SURFACE_CLASSES.filter((kind) => kind.endsWith("-wall")),
  "screen-foreground",
];

/** The z-index of the furthest surface: below the depth stack's players and items. */
const PAINT_BASE = depthZIndex(0) - 100;

/**
 * Where a surface paints. Surfaces paint beneath the rest of their template, back to front. In the challenge
 * foreground, where players sort by depth, the rear and side walls stand behind every player and the front wall in
 * front of them all. The screen foreground paints over the rest of its template, and in front of every player too.
 */
export const surfaceZIndex = (kind: SurfaceKind, inDepthStack: boolean): number => {
  if (kind === "screen-foreground") return depthZIndex(100) + 2;
  if (inDepthStack && kind === "front-wall") return depthZIndex(100) + 1;
  if (inDepthStack && kind.endsWith("-wall")) return depthZIndex(0) - 1;
  return PAINT_BASE + PAINT_ORDER.indexOf(kind);
};

/**
 * Where a surface appears on screen, if it can be seen.
 * @param aspect the surface's box's height over its width
 * @param horizon how far back the horizon background in the surface's template stands, if it has one
 */
const drawSurface = (
  surface: Surface,
  view: FloorView,
  size: MaskSize,
  { aspect, horizon }: { aspect: number; horizon: number | undefined },
): Drawn | undefined => {
  const { kind, area, distance, depth } = surface;
  switch (kind) {
    case "screen-background":
    case "screen-foreground":
      return screenSurface(size);
    case "floor-area":
      return area && { quad: floorAreaQuad(view, size, area) };
    case "floor-background":
      return floorBackgroundSurface(view, size, { depth, distance: horizon ?? distance });
    case "horizon-background": {
      const quad = horizonSurface(view, size, distance);
      return quad && { quad };
    }
    default:
      return uprightSurface(view, size, { ...surface, side: kind.split("-")[0] as FloorSide, aspect });
  }
};

/** Sets an inline style property, only if it changes, so an unchanged element costs no style work. */
export const setStyle = (element: HTMLElement, property: string, value: string) => {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
};

/** The box properties the engine sets where it works out a surface's size. */
const BOX_PROPERTIES = ["width", "height", "--floor-unit"];

/** The properties surface placement sets, which it takes off again when it stops. */
export const SURFACE_PROPERTIES = [
  "transform-origin",
  "transform",
  "z-index",
  "visibility",
  "width",
  "height",
  "--floor-unit",
];

/**
 * The most pixels a box the engine sizes reaches across or down. `ponytail:` a box that would be larger is drawn at a
 * smaller scale, given by `--floor-unit`; a texture that blurs near the camera would want the floor background split.
 */
const MAX_BOX_PIXELS = 4096;

/** How far back the horizon background stands in the same template as an element, if there is one. */
const horizonNear = (element: Element): number | undefined => {
  const horizon = element.closest(".templateBody")?.querySelector(".horizon-background");
  return horizon ? parseSurface(horizon)?.distance : undefined;
};

/**
 * The surfaces whose boxes the engine has sized, each with its box's own height over width from before, which still
 * sets the height of a surface the engine only widens. It lets go of a box whose content sets its size again.
 */
const sizedBoxes = new WeakMap<HTMLElement, number>();

/** A surface's box's own height over width, as it was before the engine sized it. */
const ownAspect = (element: HTMLElement): number =>
  sizedBoxes.get(element) ?? (element.offsetWidth > 0 ? element.offsetHeight / element.offsetWidth : 0);

/**
 * Sizes a box the engine works out: one in floor units at the floor's scale at its front edge, or smaller if that
 * would be too large, giving that scale as `--floor-unit`; or one in pixels as it is. A box the engine doesn't size
 * keeps its own.
 * @returns the box's size, in pixels
 */
const sizeBox = (element: HTMLElement, view: FloorView, size: MaskSize, drawn: Drawn | undefined): MaskSize => {
  const { extent, pixels } = drawn ?? {};
  if (!extent && !pixels) {
    if (sizedBoxes.delete(element)) BOX_PROPERTIES.forEach((property) => element.style.removeProperty(property));
    return { width: element.offsetWidth, height: element.offsetHeight };
  }
  const unit = extent
    ? Math.min(rowLength(view, size, 100) / 100, MAX_BOX_PIXELS / Math.max(extent.width, extent.height))
    : 1;
  const box = extent ? { width: extent.width * unit, height: extent.height * unit } : pixels!;
  if (!sizedBoxes.has(element)) sizedBoxes.set(element, ownAspect(element));
  // Written as the browser normalises them, so an unchanged box isn't rewritten every frame
  setStyle(element, "width", `${Number(box.width.toFixed(1))}px`);
  setStyle(element, "height", `${Number(box.height.toFixed(1))}px`);
  if (extent) setStyle(element, "--floor-unit", `${unit.toFixed(4)}px`);
  return box;
};

/**
 * Draws one surface onto its place on screen with a `matrix3d`, from its box's top left. A surface that can't be seen
 * (a horizon above the viewport) is hidden.
 * @param size the viewport's size, in pixels
 * @param offset where the layout put the surface's top left, in viewport pixels, ignoring transforms
 * @returns whether it is a surface
 */
export const placeSurface = (element: HTMLElement, view: FloorView, size: MaskSize, offset: Point): boolean => {
  const surface = parseSurface(element);
  if (!surface) return false;
  const drawn = drawSurface(surface, view, size, { aspect: ownAspect(element), horizon: horizonNear(element) });
  const box = sizeBox(element, view, size, drawn);
  const quad = drawn?.quad;
  const shift = ({ x, y }: Point): Point => ({ x: x - offset.x, y: y - offset.y });
  const matrix =
    quad && box.width > 0 && box.height > 0
      ? matrix3dFor(box, {
          backLeft: shift(quad.backLeft),
          backRight: shift(quad.backRight),
          frontRight: shift(quad.frontRight),
          frontLeft: shift(quad.frontLeft),
        })
      : undefined;
  setStyle(element, "transform-origin", "0 0");
  // Visible outright once drawn, over the stylesheet's hiding of surfaces not yet placed
  setStyle(element, "visibility", matrix ? "visible" : "hidden");
  if (matrix) setStyle(element, "transform", matrix);
  setStyle(element, "z-index", String(surfaceZIndex(surface.kind, element.closest(`.${DEPTH_STACK_CLASS}`) !== null)));
  return true;
};
