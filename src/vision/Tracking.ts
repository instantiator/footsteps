import type { KeyPointName, KeyPoints, Point, VisionFrame, VisionPerson } from "./VisionTypes";

/** One Euro filter settings: below `MIN_CUTOFF_HZ` jitter is smoothed hard; faster motion is followed via `BETA`. */
const MIN_CUTOFF_HZ = 1;
/** How much speed (pixels per second) raises the cutoff, so fast moves aren't lagged. */
const BETA = 0.01;
/** The cutoff for smoothing the speed itself. */
const DERIVATIVE_CUTOFF_HZ = 1;

/** The furthest a person's centre may move between frames, as a fraction of the frame width, and still match. */
const MAX_MATCH_DISTANCE = 0.25;

/** How long a person may go unseen, in milliseconds, before a returning one counts as someone new. */
const TRACK_TIMEOUT_MS = 500;

/** The smoothing factor for a low-pass filter at the given cutoff, over the given interval. */
const alpha = (cutoffHz: number, seconds: number): number => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / seconds);
};

/**
 * Smooths one coordinate with the One Euro filter (Casiez et al., 2012): steady when still, responsive when moving.
 */
export class OneEuroFilter {
  private value: number | undefined;
  private speed = 0;
  private time = 0;

  /**
   * Filters a new sample.
   * @param value the raw coordinate
   * @param timestamp when it was sampled, in milliseconds
   * @returns the smoothed coordinate
   */
  filter(value: number, timestamp: number): number {
    if (this.value === undefined) {
      [this.value, this.time] = [value, timestamp];
      return value;
    }
    const seconds = (timestamp - this.time) / 1000;
    if (seconds <= 0) return this.value;

    const rawSpeed = (value - this.value) / seconds;
    this.speed += alpha(DERIVATIVE_CUTOFF_HZ, seconds) * (rawSpeed - this.speed);
    const cutoff = MIN_CUTOFF_HZ + BETA * Math.abs(this.speed);
    this.value += alpha(cutoff, seconds) * (value - this.value);
    this.time = timestamp;
    return this.value;
  }
}

/** How long someone the model loses is still shown where they were, then how long they take to fade out. */
export interface HoldTimes {
  /** Milliseconds shown as they were. */
  holdMs: number;
  /** Milliseconds fading out after that. */
  fadeMs: number;
}

/** A person seen in earlier frames. */
interface Track {
  id: number;
  centre: Point;
  lastSeen: number;
  /** The person as last seen, to show while the model has lost them. */
  last: VisionPerson;
  /** Their key points as the model last placed them, before smoothing, to measure how far they move. */
  detected: KeyPoints;
  /** An x and y filter per key point, reset whenever the point goes missing. */
  filters: Partial<Record<KeyPointName, [OneEuroFilter, OneEuroFilter]>>;
}

/** The centre of a person's silhouette, or null if it is empty. */
const centreOf = ({ mask }: VisionPerson, width: number): Point | null => {
  let x = 0;
  let y = 0;
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    const column = i % width;
    x += column;
    y += (i - column) / width;
    count++;
  }
  return count === 0 ? null : { x: x / count, y: y / count };
};

/**
 * A mask with the frame before's mask laid over it, moved by the given offset in pixels, so a part the model missed
 * for one frame is still there. Only the frame before is used, so a part that is really gone is gone a frame later.
 */
export const fillFromPrevious = (mask: Uint8Array, previous: Uint8Array, width: number, offset: Point): Uint8Array => {
  const filled = mask.slice();
  const height = mask.length / width;
  for (let y = Math.max(0, offset.y); y < Math.min(height, height + offset.y); y++) {
    for (let x = Math.max(0, offset.x); x < Math.min(width, width + offset.x); x++) {
      if (previous[(y - offset.y) * width + x - offset.x] === 1) filled[y * width + x] = 1;
    }
  }
  return filled;
};

/**
 * How far, in whole pixels, a person moved since the frame before: the mean move of the key points placed in both
 * frames, or else of their silhouette's centre. Key points come first because the centre jumps when the model misses
 * a part, which is when a fill is needed.
 */
const movement = (now: KeyPoints, before: KeyPoints, centre: Point | null, centreBefore: Point): Point => {
  const moves = (Object.keys(now) as KeyPointName[]).flatMap((name) => {
    const [a, b] = [before[name], now[name]];
    return a && b ? [{ x: b.x - a.x, y: b.y - a.y }] : [];
  });
  const mean =
    moves.length > 0
      ? {
          x: moves.reduce((sum, move) => sum + move.x, 0) / moves.length,
          y: moves.reduce((sum, move) => sum + move.y, 0) / moves.length,
        }
      : { x: (centre ?? centreBefore).x - centreBefore.x, y: (centre ?? centreBefore).y - centreBefore.y };
  return { x: Math.round(mean.x), y: Math.round(mean.y) };
};

/** The squared distance between two points. */
const distanceSquared = (a: Point, b: Point): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Follows people from frame to frame: each keeps their id while they stay in view, and their key points are smoothed.
 *
 * People are matched to the previous frame's greedily, nearest first, by the centres of their silhouettes.
 *
 * Someone the model loses for a moment (a track with nobody matched to it) is held: their last silhouette is shown
 * for a while, then fades. Someone who moved is matched where they now are, so holding never leaves a trail.
 */
export class PersonTracker {
  private tracks: Track[] = [];
  private nextId = 0;
  private readonly hold: HoldTimes;
  private readonly fillGaps: boolean;

  /**
   * @param hold how long to keep showing someone the model loses; nobody is held by default
   * @param fillGaps whether to fill parts the model missed from the frame before (see {@link fillFromPrevious})
   */
  constructor(hold: HoldTimes = { holdMs: 0, fadeMs: 0 }, fillGaps = false) {
    this.hold = hold;
    this.fillGaps = fillGaps;
  }

  /** The frame with each person's id made stable and their key points smoothed, and anyone held added. */
  update(frame: VisionFrame): VisionFrame {
    const { width, timestamp } = frame;
    const timeout = Math.max(TRACK_TIMEOUT_MS, this.hold.holdMs + this.hold.fadeMs);
    this.tracks = this.tracks.filter((track) => timestamp - track.lastSeen <= timeout);
    const centres = frame.people.map((person) => centreOf(person, width));
    const owners = this.match(centres, width);
    const seen = new Set<Track>();

    const people = frame.people.map((person, index) => {
      let track = owners.get(index);
      if (!track) {
        const { keyPoints: detected } = person;
        track = { id: this.nextId++, centre: { x: 0, y: 0 }, lastSeen: timestamp, last: person, detected, filters: {} };
        this.tracks.push(track);
      }
      const filled = this.fillGaps && owners.has(index) ? this.fill(person, track, centres[index], width) : undefined;
      track.centre = centres[index] ?? track.centre;
      track.lastSeen = timestamp;
      const keyPoints = this.smooth(track, person.keyPoints, timestamp);
      track.last = { ...person, id: track.id, keyPoints, ...(filled && { filled }) };
      track.detected = person.keyPoints;
      seen.add(track);
      return track.last;
    });
    return { ...frame, people: [...people, ...this.held(seen, timestamp)] };
  }

  /** The person's mask filled from their track's last one, moved as far as they have. */
  private fill(person: VisionPerson, track: Track, centre: Point | null, width: number): Uint8Array {
    const moved = movement(person.keyPoints, track.detected, centre, track.centre);
    return fillFromPrevious(person.mask, track.last.mask, width, moved);
  }

  /** The people lost this frame who are still held, drawn as they were last seen, fading once the hold is over. */
  private held(seen: Set<Track>, timestamp: number): VisionPerson[] {
    const { holdMs, fadeMs } = this.hold;
    return this.tracks.flatMap((track) => {
      if (seen.has(track)) return [];
      const age = timestamp - track.lastSeen;
      const opacity = age <= holdMs ? 1 : fadeMs > 0 ? 1 - (age - holdMs) / fadeMs : 0;
      return opacity > 0 ? [{ ...track.last, held: { opacity } }] : [];
    });
  }

  /** Pairs people with existing tracks, nearest first, within reach; returns the track for each matched person. */
  private match(centres: (Point | null)[], width: number): Map<number, Track> {
    const reach = (MAX_MATCH_DISTANCE * width) ** 2;
    const pairs: [person: number, track: Track, distance: number][] = [];
    centres.forEach((centre, person) => {
      if (!centre) return;
      for (const track of this.tracks) {
        const distance = distanceSquared(centre, track.centre);
        if (distance <= reach) pairs.push([person, track, distance]);
      }
    });
    pairs.sort((a, b) => a[2] - b[2]);

    const owners = new Map<number, Track>();
    const taken = new Set<Track>();
    for (const [person, track] of pairs) {
      if (owners.has(person) || taken.has(track)) continue;
      owners.set(person, track);
      taken.add(track);
    }
    return owners;
  }

  /** Smooths each placed key point with the track's filters; a point that went missing starts afresh. */
  private smooth(track: Track, keyPoints: KeyPoints, timestamp: number): KeyPoints {
    const smoothed = { ...keyPoints };
    for (const name of Object.keys(keyPoints) as KeyPointName[]) {
      const point = keyPoints[name];
      if (!point) {
        delete track.filters[name];
        continue;
      }
      const [fx, fy] = (track.filters[name] ??= [new OneEuroFilter(), new OneEuroFilter()]);
      smoothed[name] = { x: fx.filter(point.x, timestamp), y: fy.filter(point.y, timestamp) };
    }
    return smoothed;
  }
}
