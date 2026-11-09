import type { Point } from "../../../vision/VisionTypes";
import type { FloorView, MaskSize } from "../../camera/FloorGeometry";
import {
  backgroundQuad,
  floorAreaQuad,
  groundQuad,
  horizonQuad,
  matrix3dFor,
  wallQuad,
  type FloorArea,
  type FloorSide,
  type Quad,
} from "../../camera/FloorSurfaces";
import { DEPTH_STACK_CLASS, depthZIndex } from "../../camera/PlayerPosition";

/** The surface classes, in the order they paint, back to front, with floor areas between the floor and the walls. */
export const SURFACE_CLASSES = [
  "horizon-background",
  "ground-background",
  "rear-background",
  "left-background",
  "right-background",
  "floor-background",
  "rear-wall",
  "left-wall",
  "right-wall",
  "front-wall",
] as const;

/** A kind of floor surface: one of the classes, or a floor area. */
export type SurfaceKind = (typeof SURFACE_CLASSES)[number] | "floor-area";

/** The attribute that lays an element on a rectangle of the floor. */
export const FLOOR_AREA_ATTRIBUTE = "data-floor-area";

/** The selector for every floor surface. */
export const SURFACE_SELECTOR = [`[${FLOOR_AREA_ATTRIBUTE}]`, ...SURFACE_CLASSES.map((name) => `.${name}`)].join(", ");

/** How high a wall stands when its height isn't given, in floor x units: as high as the floor is wide. */
export const DEFAULT_WALL_HEIGHT = 100;

/** How far beyond the floor's edge a background stands when its distance isn't given, in floor units. */
export const BACKGROUND_DISTANCE = 50;

/** A floor surface, from its class or `data-floor-area`, and its `data-floor-height` and `data-wall-distance`. */
export interface Surface {
  /** Which surface it is. */
  kind: SurfaceKind;
  /** The rectangle a floor area covers. */
  area?: FloorArea;
  /** How high a wall stands, in floor x units. */
  height: number;
  /** How far beyond the floor's edge an upright surface stands, in floor units. */
  distance: number;
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

/** An element's surface, which comes from game content; null if it isn't one, or its floor area is malformed. */
export const parseSurface = (element: Element): Surface | null => {
  const height = numberOf(element.getAttribute("data-floor-height")) ?? DEFAULT_WALL_HEIGHT;
  const distance = numberOf(element.getAttribute("data-wall-distance"));
  if (element.hasAttribute(FLOOR_AREA_ATTRIBUTE)) {
    const area = parseFloorArea(element.getAttribute(FLOOR_AREA_ATTRIBUTE));
    return area ? { kind: "floor-area", area, height, distance: 0 } : null;
  }
  const kind = SURFACE_CLASSES.find((name) => element.classList.contains(name));
  if (!kind) return null;
  return { kind, height, distance: distance ?? (kind.endsWith("-background") ? BACKGROUND_DISTANCE : 0) };
};

/** Every surface kind, back to front. */
const PAINT_ORDER: readonly SurfaceKind[] = [...SURFACE_CLASSES.slice(0, 6), "floor-area", ...SURFACE_CLASSES.slice(6)];

/** The z-index of the furthest surface: below the depth stack's players and items. */
const PAINT_BASE = depthZIndex(0) - 100;

/**
 * Where a surface paints. Surfaces paint beneath the rest of their template, back to front. In the challenge
 * foreground, where players sort by depth, the rear and side walls stand behind every player and the front wall in
 * front of them all.
 */
export const surfaceZIndex = (kind: SurfaceKind, inDepthStack: boolean): number => {
  if (inDepthStack && kind === "front-wall") return depthZIndex(100) + 1;
  if (inDepthStack && kind.endsWith("-wall")) return depthZIndex(0) - 1;
  return PAINT_BASE + PAINT_ORDER.indexOf(kind);
};

/** Where a surface appears on screen, if it can be seen. */
const surfaceQuad = ({ kind, area, height, distance }: Surface, view: FloorView, size: MaskSize): Quad | undefined => {
  const side = kind.split("-")[0] as FloorSide;
  switch (kind) {
    case "floor-area":
      return area && floorAreaQuad(view, size, area);
    case "floor-background":
      return floorAreaQuad(view, size, { left: 0, back: 0, right: 100, front: 100 });
    case "ground-background":
      return groundQuad(view, size);
    case "horizon-background":
      return horizonQuad(view, size);
    case "rear-background":
    case "left-background":
    case "right-background":
      return backgroundQuad(view, size, side as Exclude<FloorSide, "front">, distance);
    default:
      return wallQuad(view, size, side, { height, distance });
  }
};

/** Sets an inline style property, only if it changes, so an unchanged element costs no style work. */
export const setStyle = (element: HTMLElement, property: string, value: string) => {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
};

/** The properties surface placement sets, which it takes off again when it stops. */
export const SURFACE_PROPERTIES = ["transform-origin", "transform", "z-index", "visibility"];

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
  const quad = surfaceQuad(surface, view, size);
  const box = { width: element.offsetWidth, height: element.offsetHeight };
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
  setStyle(element, "visibility", matrix ? "" : "hidden");
  if (matrix) setStyle(element, "transform", matrix);
  setStyle(element, "z-index", String(surfaceZIndex(surface.kind, element.closest(`.${DEPTH_STACK_CLASS}`) !== null)));
  return true;
};
