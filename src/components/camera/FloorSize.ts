/**
 * The floor's real size, and the person-scale sizes it gives templates, so games can make doors, rings and the like
 * life-size in any room. Floor units are 1% of the floor's width across and up, and 1% of its depth from back to
 * front (see `FloorGeometry.ts`).
 */

/** A rectangular floor's real size, in metres, as the player measured it. */
export interface FloorSize {
  /** From its left edge to its right. */
  width: number;
  /** From its back edge to its front. */
  depth: number;
}

/** The floor the default corners make (see `DEFAULT_CORNERS`), assumed when nobody has measured theirs. */
export const DEFAULT_FLOOR_SIZE: FloorSize = { width: 2.6, depth: 2 };

/** The real sizes the scale is made from, in metres: an adult, their waist and chest heights, and a door. */
const PERSON_METRES = { person: 1.7, waist: 0.9, chest: 1.3, door: 2, doorWidth: 0.9 };

/** Person-scale sizes in floor units, which templates read as `{{scale.person}}` and so on. */
export interface FloorScale {
  /** A metre across the floor, or up from it. */
  metre: number;
  /** A metre from the floor's back to its front, in its y coordinate. */
  metreDeep: number;
  /** An adult's height. */
  person: number;
  /** Waist height. */
  waist: number;
  /** Chest height. */
  chest: number;
  /** A door's height. */
  door: number;
  /** A door's width, across the floor. */
  doorWidth: number;
}

/** One decimal place: plenty for placing things, and tidy in templates. */
const tenths = (value: number): number => Math.round(value * 10) / 10;

/** The person-scale sizes on a floor of the given size. */
export const floorScale = ({ width, depth }: FloorSize): FloorScale => {
  const metre = 100 / width;
  const scaled = (metres: number) => tenths(metres * metre);
  return {
    metre: tenths(metre),
    metreDeep: tenths(100 / depth),
    person: scaled(PERSON_METRES.person),
    waist: scaled(PERSON_METRES.waist),
    chest: scaled(PERSON_METRES.chest),
    door: scaled(PERSON_METRES.door),
    doorWidth: scaled(PERSON_METRES.doorWidth),
  };
};

/** The smallest and largest floor sizes accepted, in metres: any smaller or larger is surely a typing mistake. */
const SIZE_RANGE = { min: 0.5, max: 20 };

/** Whether a value is a sensible floor size. */
export const isFloorSize = (value: unknown): value is FloorSize =>
  typeof value === "object" &&
  value !== null &&
  [(value as Record<string, unknown>).width, (value as Record<string, unknown>).depth].every(
    (metres) => typeof metres === "number" && metres >= SIZE_RANGE.min && metres <= SIZE_RANGE.max,
  );

/** A floor size as the player types it: metres, or blank. */
export interface FloorSizeText {
  /** The width, as typed. */
  width: string;
  /** The depth, as typed. */
  depth: string;
}

/** A floor size as text to edit; blank when there is none. */
export const textOfFloorSize = (size: FloorSize | undefined): FloorSizeText => ({
  width: size ? String(size.width) : "",
  depth: size ? String(size.depth) : "",
});

/**
 * What the player typed: no size when both are blank, a size when both are sensible, or "invalid" otherwise, which
 * can't be saved.
 */
export const floorSizeOfText = ({ width, depth }: FloorSizeText): FloorSize | undefined | "invalid" => {
  if (width.trim() === "" && depth.trim() === "") return undefined;
  const size = { width: Number(width), depth: Number(depth) };
  return isFloorSize(size) ? size : "invalid";
};
