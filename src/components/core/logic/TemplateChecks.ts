/**
 * Checks on a template's text that need nothing but the text: shared by the resource validator and the scene renderer
 * page. This module imports nothing from the browser or Node, so both can use it.
 */
import { FLOOR_AREA_ATTRIBUTE, SURFACE_CLASSES } from "../layout/FloorSurfaceClasses.ts";

/** What a template's text gets wrong. */
export interface TemplateMessages {
  /** What stops the template working. */
  problems: string[];
  /** What is probably a mistake, but doesn't stop it working. */
  warnings: string[];
}

/** A class attribute naming a floor surface as a whole class name. */
const SURFACE_CLASS = new RegExp(`class\\s*=\\s*["'][^"']*(?<![\\w-])(${SURFACE_CLASSES.join("|")})(?![\\w-])`);

/** What does nothing outside a 2.5D scene: floor items, and floor surfaces. */
const floorOnlyWarnings = (text: string) => [
  ...(/\bdata-floor-(?!area)/.test(text) ? ["data-floor-* does nothing here, as this scene never shows in 2.5D"] : []),
  ...(SURFACE_CLASS.test(text) ||
  text.includes(FLOOR_AREA_ATTRIBUTE) ||
  /\bdata-(wall-distance|fill-height|fill-width|fill-edge)\b/.test(text)
    ? ["floor surfaces do nothing here, as this scene never shows in 2.5D"]
    : []),
];

const WALLS = ["rear-wall", "left-wall", "right-wall", "front-wall"];
const BACKGROUNDS = ["rear-background", "left-background", "right-background"];

/** The surface attributes that only shape some surfaces, which ones, and what each does. */
const SURFACE_ATTRIBUTES = [
  { name: "data-fill-height", on: [...WALLS, ...BACKGROUNDS], does: "stretches a wall or background up to the top" },
  {
    name: "data-fill-width",
    on: ["rear-wall", "front-wall", "rear-background"],
    does: "stretches a rear or front wall, or the rear background, to the sides",
  },
  {
    name: "data-fill-edge",
    on: ["left-wall", "right-wall", "left-background", "right-background"],
    does: "picks which end of a side wall or background reaches the top",
  },
  { name: "data-floor-depth", on: ["floor-background"], does: "lowers the floor background" },
];

/** Each start tag in a template's text: its class names, and whether it has an attribute. */
const startTags = (text: string) =>
  [...text.matchAll(/<[a-zA-Z][^>]*>/g)].map(([tag]) => ({
    classes: /\bclass\s*=\s*["']([^"']*)["']/.exec(tag)?.[1].split(/\s+/) ?? [],
    has: (name: string) => new RegExp(`\\s${name}(?=[\\s=/>])`).test(tag),
  }));

/** A surface attribute on an element it does nothing for, such as `data-fill-width` on a side wall. */
const misplacedSurfaceAttributes = (text: string) =>
  startTags(text).flatMap(({ classes, has }) =>
    SURFACE_ATTRIBUTES.filter(({ name, on }) => has(name) && !classes.some((kind) => on.includes(kind))).map(
      ({ name, does }) => `${name} does nothing here: it only ${does}`,
    ),
  );

/**
 * What a template's text gets wrong: `data-depth`, which has gone, and floor items and surfaces where they do nothing.
 * `can25D` says whether its scene can ever show in 2.5D.
 */
export const templateMessages = (text: string, can25D: boolean): TemplateMessages => ({
  problems: /\bdata-depth\b/.test(text)
    ? ["data-depth is no longer supported; give the item data-floor-y (see game-data.md)"]
    : [],
  warnings: can25D ? misplacedSurfaceAttributes(text) : floorOnlyWarnings(text),
});
