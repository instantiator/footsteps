/**
 * The names that make an element a floor surface. This module imports nothing, so the resource validator can read it.
 */

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

/** The attribute that lays an element on a rectangle of the floor. */
export const FLOOR_AREA_ATTRIBUTE = "data-floor-area";
