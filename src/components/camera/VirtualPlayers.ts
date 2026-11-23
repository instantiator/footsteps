/**
 * A spike (003.00.03 S4 + S5), off by default: players drawn smaller than life (`playerScale`), and moving further than
 * they walk (`motionGain`), so a small room can play a big set.
 *
 * Each player gets a placement: their cut-out shrunk about their ground point, which is moved to where their position,
 * scaled out from the floor's centre by the gain, lies. The drawn cut-out is moved by CSS ({@link placementStyle}),
 * and the masks and key points the game reads are moved the same way ({@link placePerson}), so what is drawn and what
 * touches things agree.
 *
 * `ponytail:` the mask is resampled nearest-neighbour each frame, a full pass per player; fine for a spike, and the
 * place to look if it's kept and players are many.
 */
import _ from "lodash";
import type { Point, VisionFrame, VisionPerson } from "../../vision/VisionTypes";
import { imageForScreenFloor, type Corners } from "./FloorGeometry";
import type { PlayerPosition } from "./PlayerPosition";

/** How players are drawn and moved: both 1 for life size and real movement. */
export interface VirtualSettings {
  /** How big players are drawn, compared with life. */
  playerScale: number;
  /** How far a player's position moves from the floor's centre, compared with how far they walk. */
  motionGain: number;
}

/** Whether the settings leave players as they are. */
export const isLifelike = ({ playerScale, motionGain }: VirtualSettings): boolean =>
  playerScale === 1 && motionGain === 1;

/** Where a player is drawn: their ground point moves `from` → `to` (image fractions), and they are `scale`d about it. */
export interface Placement {
  /** Their real ground point. */
  from: Point;
  /** Where it is drawn. */
  to: Point;
  /** How much bigger they are drawn. */
  scale: number;
}

/** The floor the positions are on: its corners in a 2.5D scene, none in a 2D one (positions are % of the scene). */
export interface PlacementFloor {
  /** The floor's corners; none in a 2D scene. */
  corners?: Corners;
  /** Whether positions run from the mirrored image's side. */
  mirrored: boolean;
}

/** The floor's centre, in positions. */
const CENTRE = 50;

/** Where a position lies in the image, in fractions: the inverse of `positionMapping`. */
const imageOf = (position: Point, { corners, mirrored }: PlacementFloor): Point =>
  corners
    ? imageForScreenFloor(corners, position, mirrored)
    : { x: (mirrored ? 100 - position.x : position.x) / 100, y: position.y / 100 };

/** How wide the floor is in the image at a depth, so a player moved nearer is drawn bigger; 1 without a floor. */
const widthAt = (y: number, floor: PlacementFloor): number => {
  if (!floor.corners) return 1;
  const [left, right] = [0, 100].map((x) => imageOf({ x, y }, floor));
  return Math.hypot(right.x - left.x, right.y - left.y);
};

/** Where a position is placed: scaled out from the floor's centre by the gain. */
const placedPosition = ({ x, y }: Point, motionGain: number): Point => ({
  x: CENTRE + motionGain * (x - CENTRE),
  y: CENTRE + motionGain * (y - CENTRE),
});

/** Each player's placement, by id, from their real position. */
export const placementsOf = (
  positions: Map<number, PlayerPosition>,
  floor: PlacementFloor,
  { playerScale, motionGain }: VirtualSettings,
): Map<number, Placement> =>
  new Map(
    [...positions].map(([id, { ground, position }]) => {
      const placed = placedPosition(position, motionGain);
      const scale = (playerScale * widthAt(placed.y, floor)) / widthAt(position.y, floor);
      return [id, { from: { x: ground.x / 100, y: ground.y / 100 }, to: imageOf(placed, floor), scale }];
    }),
  );

/** A point moved by a placement, in pixels of a frame of the given size. */
const placePoint = ({ x, y }: Point, { from, to, scale }: Placement, width: number, height: number): Point => ({
  x: to.x * width + scale * (x - from.x * width),
  y: to.y * height + scale * (y - from.y * height),
});

/** A mask in its placed position, each pixel sampled from the nearest one it came from. */
const placeMask = (mask: Uint8Array, { from, to, scale }: Placement, width: number, height: number): Uint8Array => {
  const placed = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.round(from.y * height + (y - to.y * height) / scale);
    if (sourceY < 0 || sourceY >= height) continue;
    for (let x = 0; x < width; x++) {
      const sourceX = Math.round(from.x * width + (x - to.x * width) / scale);
      if (sourceX >= 0 && sourceX < width) placed[y * width + x] = mask[sourceY * width + sourceX];
    }
  }
  return placed;
};

/** A person as the game should see them once placed: their mask, key points and size moved with their cut-out. */
export const placePerson = (
  person: VisionPerson,
  placement: Placement,
  width: number,
  height: number,
): VisionPerson => {
  return {
    ...person,
    mask: placeMask(person.mask, placement, width, height),
    keyPoints: _.mapValues(person.keyPoints, (point) => point && placePoint(point, placement, width, height)),
    scale: person.scale * placement.scale,
  };
};

/** A frame with each placed person moved; people without a placement stay as they are. */
export const placeFrame = (frame: VisionFrame, placements: Map<number, Placement>): VisionFrame => ({
  ...frame,
  people: frame.people.map((person) => {
    const placement = placements.get(person.id);
    return placement ? placePerson(person, placement, frame.width, frame.height) : person;
  }),
});

/** The CSS that moves a player's drawn cut-out to their placement; none to leave it be. */
export const placementStyle = (
  placement: Placement | undefined,
): Pick<CSSStyleDeclaration, "transform" | "transformOrigin"> =>
  placement
    ? {
        transformOrigin: `${placement.from.x * 100}% ${placement.from.y * 100}%`,
        transform: `translate(${(placement.to.x - placement.from.x) * 100}%, ${(placement.to.y - placement.from.y) * 100}%) scale(${placement.scale})`,
      }
    : { transformOrigin: "", transform: "" };

/** The players as the game sees them once placed, and where to draw each; unchanged when the settings are lifelike. */
export interface PlacedPlayers {
  /** The frame, with each placed person moved. */
  frame: VisionFrame;
  /** Each player's position, placed; their ground point stays real, as it is drawn on their unmoved canvas. */
  positions: Map<number, PlayerPosition>;
  /** Where each player is drawn, by id. */
  placements: Map<number, Placement>;
}

/** Places the players in a frame by the settings: see {@link placementsOf}. */
export const placePlayers = (
  frame: VisionFrame,
  positions: Map<number, PlayerPosition>,
  floor: PlacementFloor,
  settings: VirtualSettings,
): PlacedPlayers => {
  if (isLifelike(settings)) return { frame, positions, placements: new Map() };
  const placements = placementsOf(positions, floor, settings);
  const placed = new Map(
    [...positions].map(([id, where]) => [
      id,
      { ...where, position: placedPosition(where.position, settings.motionGain) },
    ]),
  );
  return { frame: placeFrame(frame, placements), positions: placed, placements };
};
