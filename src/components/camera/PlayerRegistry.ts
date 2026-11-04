import { centreOf, MAX_MATCH_DISTANCE } from "../../vision/Tracking";
import type { VisionFrame, VisionPerson } from "../../vision/VisionTypes";
import type { DisplayScope } from "../../entities/state/GameState";
import type { MaskSize } from "./CameraSupport";

/**
 * What can happen to a player: `active` is in play, `leaving` is falling or being knocked away, `frozen` is stopped in
 * place, and `removed` has gone until restored.
 */
export type PlayerState = "active" | "leaving" | "frozen" | "removed";

/** How many players there are, for expressions. */
export interface PlayerCounts {
  /** Players in shot and not removed, including any the model has lost for a moment, and those leaving or frozen. */
  active: number;
  /** Players removed since their display last reset. */
  removed: number;
  /** Players frozen now. They also count as active. */
  frozen: number;
}

/** No players at all. */
export const NO_PLAYERS: PlayerCounts = { active: 0, removed: 0, frozen: 0 };

/** What a frame means, given what has happened to its players. Every person's id is their stable player id. */
export interface PlayerFrames {
  /** The players who can interact with the display. */
  interactive: VisionFrame;
  /** The players to draw. Frozen and leaving ones are as they were last seen, and held, which keeps their depth. */
  drawn: VisionFrame;
  /** The players whose canvases shouldn't be redrawn, as their image is frozen. */
  frozenIds: ReadonlySet<number>;
  /** Everyone the game still knows about, so their canvases stay, including removed players. */
  knownIds: ReadonlySet<number>;
}

/** One player the game knows about. */
interface Player {
  /** Stays the same however the tracker follows them. */
  id: number;
  /** Lowest free from 1, kept while they are known. What `.player-N` and `event.player` use. */
  number: number;
  state: PlayerState;
  /** Their id in the tracker, or null if it has lost them: a note of where they were, that someone may inherit. */
  trackId: number | null;
  /** The display whose rule set their state. */
  setBy?: DisplayScope;
  /** How they looked in the last frame, or when they stopped being active. */
  last: VisionPerson;
  /** Where their silhouette's centre was when the tracker lost them, in mask pixels. */
  centre?: { x: number; y: number };
}

/** Whether a player's image has stopped updating. */
const isStill = ({ state }: Player): boolean => state === "leaving" || state === "frozen";

/**
 * Follows what has happened to each player across frames, for longer than the tracker follows the people themselves.
 *
 * Player state is kept by a stable id, as a tracker's ids restart with each tracking loop. When the tracker loses a
 * player who isn't active, they stay as a note of where they were, which a new person appearing near there inherits:
 * a removed player the model loses for a moment shouldn't come back as a new, active one. Someone who walks out of shot
 * and back as anyone else's replacement isn't told apart; see `docs/player-tracking.md`.
 */
export class PlayerRegistry {
  private listener?: (counts: PlayerCounts) => void;
  private readonly players = new Map<number, Player>();
  private nextId = 1;
  private counts: PlayerCounts = NO_PLAYERS;
  private size: MaskSize = { width: 0, height: 0 };

  /**
   * Hears as the counts change, not on every frame, as a game state update re-renders the game.
   * @returns how to stop hearing
   */
  onCounts(listener: (counts: PlayerCounts) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  /** Works out what a frame from the tracker means. */
  update(frame: VisionFrame): PlayerFrames {
    this.size = { width: frame.width, height: frame.height };
    const seen = new Set<Player>();
    for (const person of frame.people) {
      const player = this.playerFor(person, frame.width);
      player.trackId = person.id;
      if (!isStill(player)) player.last = { ...person, id: player.id };
      seen.add(player);
    }
    for (const player of Array.from(this.players.values())) {
      if (!seen.has(player)) this.lose(player, frame.width);
    }
    this.reportCounts();
    return this.framesFrom(frame);
  }

  /** The player with this id's number, while they are known. */
  numberOf(id: number): number | undefined {
    return this.players.get(id)?.number;
  }

  /** The id of the player with this number, while there is one. */
  idOf(number: number): number | undefined {
    return Array.from(this.players.values()).find((player) => player.number === number)?.id;
  }

  /** What has happened to a player, while they are known. */
  stateOf(id: number): PlayerState | undefined {
    return this.players.get(id)?.state;
  }

  /** The display whose rule set a player's state, if one has. */
  setByOf(id: number): DisplayScope | undefined {
    return this.players.get(id)?.setBy;
  }

  /** How a player looked in the last frame, or when they stopped being active. */
  lastOf(id: number): VisionPerson | undefined {
    return this.players.get(id)?.last;
  }

  /** The size of the masks of the latest frame. */
  frameSize(): MaskSize {
    return this.size;
  }

  /** Everyone the game knows about. */
  knownIds(): ReadonlySet<number> {
    return new Set(this.players.keys());
  }

  /** Stops a player in place. */
  freeze(id: number, scope: DisplayScope): void {
    this.change(id, "frozen", scope);
  }

  /** Starts a player leaving the display. */
  startLeaving(id: number, scope: DisplayScope): void {
    this.change(id, "leaving", scope);
  }

  /** Marks a player who has left as removed. */
  finishLeaving(id: number): void {
    this.change(id, "removed");
  }

  /** Returns a player to normal; if the tracker has lost them, they go, as there's nobody to return. */
  restore(id: number): void {
    const player = this.players.get(id);
    if (player === undefined) return;
    if (player.trackId === null) this.players.delete(id);
    else {
      player.state = "active";
      player.setBy = undefined;
      player.centre = undefined;
    }
    this.reportCounts();
  }

  /**
   * Forgets who the tracker's ids mean, as a new tracking loop starts them again. Active players come back as new ones;
   * others are noted, to be found again.
   */
  resetTracking(width: number): void {
    for (const player of Array.from(this.players.values())) this.lose(player, width);
    this.reportCounts();
  }

  /** Changes a player's state, if they are known. */
  private change(id: number, state: PlayerState, scope?: DisplayScope): void {
    const player = this.players.get(id);
    if (player === undefined) return;
    player.state = state;
    if (scope !== undefined) player.setBy = scope;
    this.reportCounts();
  }

  /** The tracker has lost a player: an active one has gone, and any other stays as a note of where they were. */
  private lose(player: Player, width: number): void {
    if (player.state === "active") {
      this.players.delete(player.id);
      return;
    }
    if (player.trackId === null) return;
    player.trackId = null;
    player.centre = centreOf(player.last, width) ?? undefined;
  }

  /** The player a person from the tracker is: the one it already calls that, one whose note they inherit, or someone new. */
  private playerFor(person: VisionPerson, width: number): Player {
    const known = Array.from(this.players.values()).find((player) => player.trackId === person.id);
    return known ?? this.inheritor(person, width) ?? this.newPlayer(person);
  }

  /** The nearest player's note within reach of a new person, as they are probably the same person. */
  private inheritor(person: VisionPerson, width: number): Player | undefined {
    const centre = centreOf(person, width);
    if (centre === null) return undefined;
    const reach = MAX_MATCH_DISTANCE * width;
    let nearest: Player | undefined;
    let nearestDistance = reach;
    for (const player of this.players.values()) {
      if (player.trackId !== null || player.centre === undefined) continue;
      const distance = Math.hypot(player.centre.x - centre.x, player.centre.y - centre.y);
      if (distance <= nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  /** A new, active player, with the lowest free number. */
  private newPlayer(person: VisionPerson): Player {
    const taken = new Set(Array.from(this.players.values()).map(({ number }) => number));
    let number = 1;
    while (taken.has(number)) number++;
    const id = this.nextId++;
    const player: Player = { id, number, state: "active", trackId: person.id, last: { ...person, id } };
    this.players.set(id, player);
    return player;
  }

  /** What each kind of player is in this frame. */
  private framesFrom(frame: VisionFrame): PlayerFrames {
    const interactive: VisionPerson[] = [];
    const drawn: VisionPerson[] = [];
    const frozenIds = new Set<number>();
    for (const player of this.players.values()) {
      if (player.state === "active") {
        interactive.push(player.last);
        drawn.push(player.last);
      } else if (isStill(player)) {
        drawn.push({ ...player.last, held: { opacity: 1 } });
        frozenIds.add(player.id);
      }
    }
    return {
      interactive: { ...frame, people: interactive },
      drawn: { ...frame, people: drawn },
      frozenIds,
      knownIds: this.knownIds(),
    };
  }

  /** Reports the counts, if they have changed. */
  private reportCounts(): void {
    const all = Array.from(this.players.values());
    const counts = {
      active: all.filter(({ state }) => state !== "removed").length,
      removed: all.filter(({ state }) => state === "removed").length,
      frozen: all.filter(({ state }) => state === "frozen").length,
    };
    const { active, removed, frozen } = this.counts;
    if (counts.active === active && counts.removed === removed && counts.frozen === frozen) return;
    this.counts = counts;
    this.listener?.(counts);
  }
}
