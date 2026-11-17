import type { Point } from "../../vision/VisionTypes";
import type { PlayerPosition } from "./PlayerPosition";

/** When someone counts as off the floor, and for how long before it changes who they are. */
export interface SpectatorSettings {
  /** How far outside the floor someone must stand to be off it, in floor units. */
  margin: number;
  /** How long someone must stay off the floor to become a spectator, or on it to become a player again, in ms. */
  holdMs: number;
}

/** A spectator who has become a player again, and how far from where they left the floor they came back on. */
export interface SpectatorReturn {
  /** The player's stable id. */
  id: number;
  /** In floor units. */
  distance: number;
}

/** Who is watching rather than playing, after a frame. */
export interface SpectatorReport {
  /** The players who are spectators now. */
  spectators: ReadonlySet<number>;
  /** How far outside the floor each player stands, in floor units: 0 on it. */
  distances: ReadonlyMap<number, number>;
  /** The spectators who became players again in this frame, having left the floor as a player. */
  returned: SpectatorReturn[];
}

/** How far from where they left the floor a spectator must come back on for it to count as elsewhere, in floor units. */
export const RETURN_DISTANCE = 25;

/** No spectators, as in a scene without a floor. */
export const NO_SPECTATORS: SpectatorReport = { spectators: new Set(), distances: new Map(), returned: [] };

/** What is known about one player's place on the floor. */
interface Watched {
  spectator: boolean;
  /** When they crossed the margin the other way, while the hold runs. */
  crossedAt?: number;
  /** Where they last stood on the floor as a player. */
  lastOn?: Point;
  /** Where they left the floor, if they left it as a player. */
  leftFrom?: Point;
}

/** How far a floor position is outside the floor, which runs 0–100 both ways, in floor units. */
export const distanceOffFloor = ({ x, y }: Point): number =>
  Math.hypot(Math.max(0, -x, x - 100), Math.max(0, -y, y - 100));

/**
 * Tells spectators from players by where they stand on the floor. Someone off the floor for the hold becomes a
 * spectator, and someone back on it for the hold becomes a player again, so stepping over an edge, or a jump at it,
 * changes nothing. Someone first seen off the floor is a spectator at once.
 */
export class SpectatorWatch {
  private readonly settings: SpectatorSettings;
  private readonly watched = new Map<number, Watched>();

  constructor(settings: SpectatorSettings) {
    this.settings = settings;
  }

  /**
   * Follows the players' floor positions.
   * @param positions each player's position on the floor, by id
   * @param now when the frame was taken, in milliseconds
   * @param known the players the game still knows, including those the tracker has lost for a while
   */
  update(positions: ReadonlyMap<number, PlayerPosition>, now: number, known: ReadonlySet<number>): SpectatorReport {
    for (const id of this.watched.keys()) if (!known.has(id)) this.watched.delete(id);
    const distances = new Map<number, number>();
    const returned: SpectatorReturn[] = [];
    for (const [id, { position }] of positions) {
      const distance = distanceOffFloor(position);
      distances.set(id, distance);
      const off = distance > this.settings.margin;
      const watched = this.watched.get(id) ?? { spectator: off };
      this.watched.set(id, watched);
      if (off === watched.spectator) watched.crossedAt = undefined;
      else if (now - (watched.crossedAt ??= now) >= this.settings.holdMs) this.flip(id, watched, position, returned);
      if (!watched.spectator && !off) watched.lastOn = position;
    }
    const spectators = new Set(Array.from(this.watched).flatMap(([id, { spectator }]) => (spectator ? [id] : [])));
    return { spectators, distances, returned };
  }

  /** Makes a player a spectator, or a spectator a player again, noting a return to the floor. */
  private flip(id: number, watched: Watched, position: Point, returned: SpectatorReturn[]): void {
    watched.spectator = !watched.spectator;
    watched.crossedAt = undefined;
    if (watched.spectator) watched.leftFrom = watched.lastOn;
    else if (watched.leftFrom !== undefined) {
      returned.push({ id, distance: Math.hypot(position.x - watched.leftFrom.x, position.y - watched.leftFrom.y) });
      watched.leftFrom = undefined;
    }
  }
}
