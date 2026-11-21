import type { Point } from "../../vision/VisionTypes";
import type { PlayerPosition } from "./PlayerPosition";

/** When someone counts as off the floor, and for how long before it changes who they are. */
export interface SpectatorSettings {
  /** How far outside the floor someone must stand to be off it, in floor units. */
  margin: number;
  /** How long someone must have been mostly off the floor to become a spectator, in ms. */
  holdMs: number;
  /** How long a spectator must have been mostly back on the floor to become a player again, in ms. */
  returnMs: number;
}

/**
 * The share of a hold's frames that must agree for it to count (0–1), so a flickering frame or two, such as a stray
 * patch of pixels under a player, neither makes them a spectator nor keeps them one.
 */
export const SPECTATOR_SHARE = 0.8;

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
  /** How long each player has been across the margin the other way, while the hold runs, in ms. */
  pendingMs: ReadonlyMap<number, number>;
}

/** How far from where they left the floor a spectator must come back on for it to count as elsewhere, in floor units. */
export const RETURN_DISTANCE = 25;

/** No spectators, as in a scene without a floor. */
export const NO_SPECTATORS: SpectatorReport = {
  spectators: new Set(),
  distances: new Map(),
  returned: [],
  pendingMs: new Map(),
};

/** What is known about one player's place on the floor. */
interface Watched {
  spectator: boolean;
  /** When they were first seen, so a hold only counts once it has been watched for its whole length. */
  since: number;
  /** Whether they were off the floor in each recent frame, newest last, as long as the longer hold. */
  recent: Seen[];
  /** When the current run of frames on the other side began, for the debug view. */
  crossedAt?: number;
  /** Where they last stood on the floor as a player. */
  lastOn?: Point;
  /** Where they left the floor, if they left it as a player. */
  leftFrom?: Point;
}

/** Whether someone was off the floor in a frame, and when. */
type Seen = { at: number; off: boolean };

/**
 * The share of the time from `from` to the newest frame spent off the floor (or, with `off` false, on it). Each frame
 * stands until the next, so frames missed for a while don't let the few seen speak for the whole time.
 */
const shareOff = (recent: Seen[], from: number, off: boolean): number => {
  const end = recent[recent.length - 1].at;
  if (end <= from) return 0;
  let agreeing = 0;
  recent.forEach((frame, i) => {
    const start = Math.max(frame.at, from);
    const until = i + 1 < recent.length ? recent[i + 1].at : end;
    if (frame.off === off && until > start) agreeing += until - start;
  });
  return agreeing / (end - from);
};

/** The frames still needed: those within the window, and the one before it, which stands at its start. */
const withinWindow = (recent: Seen[], from: number): Seen[] => {
  const first = recent.findIndex(({ at }) => at >= from);
  return first < 0 ? recent.slice(-1) : recent.slice(Math.max(0, first - 1));
};

/** How far a floor position is outside the floor, which runs 0–100 both ways, in floor units. */
export const distanceOffFloor = ({ x, y }: Point): number =>
  Math.hypot(Math.max(0, -x, x - 100), Math.max(0, -y, y - 100));

/**
 * Tells spectators from players by where they stand on the floor. Someone mostly off the floor for the hold becomes a
 * spectator, and someone mostly back on it for the (shorter) return becomes a player again, so stepping over an edge,
 * a jump at it, or a flickering frame changes nothing. Someone first seen off the floor is a spectator at once.
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
    const pendingMs = new Map<number, number>();
    const returned: SpectatorReturn[] = [];
    for (const [id, { position }] of positions) {
      distances.set(id, distanceOffFloor(position));
      const { crossedAt } = this.follow(id, position, now, returned);
      if (crossedAt !== undefined) pendingMs.set(id, now - crossedAt);
    }
    const spectators = new Set(Array.from(this.watched).flatMap(([id, { spectator }]) => (spectator ? [id] : [])));
    return { spectators, distances, returned, pendingMs };
  }

  /** Follows one player for a frame, flipping them once enough of the hold's frames have been on the other side. */
  private follow(id: number, position: Point, now: number, returned: SpectatorReturn[]): Watched {
    const { holdMs, returnMs } = this.settings;
    const off = distanceOffFloor(position) > this.settings.margin;
    const watched = this.watched.get(id) ?? { spectator: off, since: now, recent: [] };
    this.watched.set(id, watched);
    watched.recent = [...withinWindow(watched.recent, now - Math.max(holdMs, returnMs)), { at: now, off }];
    watched.crossedAt = off === watched.spectator ? undefined : (watched.crossedAt ?? now);
    const hold = watched.spectator ? returnMs : holdMs;
    if (now - watched.since >= hold && shareOff(watched.recent, now - hold, !watched.spectator) >= SPECTATOR_SHARE)
      this.flip(id, watched, position, returned);
    if (!watched.spectator && !off) watched.lastOn = position;
    return watched;
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

/** One person as the debug view lists them. */
export interface PersonReadout {
  /** Their stable id. */
  id: number;
  /** Their player number, if they have one. */
  number?: number;
  /** Whether they play, watch, or are held while the tracker has lost them. */
  role: "player" | "spectator" | "held";
  /** Where they stand on the floor, in floor units, if known. */
  position?: Point;
  /** How far outside the floor they stand, in floor units. */
  offBy: number;
  /** How long a change between player and spectator has been waiting, in ms, if one is. */
  pendingMs?: number;
}

/**
 * What the debug view shows of each person drawn this frame, so a player wrongly watching can be told apart from one
 * off the floor, or one about to change.
 * @param people the people drawn this frame, each with whether the tracker is holding them
 * @param positions each person's floor position, by id
 * @param report the spectator watch's report for the frame
 * @param numberOf a person's player number, if they have one
 */
export const describePeople = (
  people: readonly { id: number; held?: unknown }[],
  positions: ReadonlyMap<number, PlayerPosition>,
  report: SpectatorReport,
  numberOf: (id: number) => number | undefined,
): PersonReadout[] =>
  people.map(({ id, held }) => {
    const role = report.spectators.has(id) ? "spectator" : held !== undefined ? "held" : "player";
    return {
      id,
      number: numberOf(id),
      role,
      position: positions.get(id)?.position,
      offBy: report.distances.get(id) ?? 0,
      pendingMs: report.pendingMs.get(id),
    };
  });
