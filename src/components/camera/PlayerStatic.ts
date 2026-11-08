/** What a player's static looks like now. */
export interface StaticLook {
  /** The size of each block, as a % of the scene's width. */
  pixelSize: number;
  /** The proportion of blocks made transparent (0–1). */
  proportion: number;
  /** Whether the pattern holds still, for players who prefer reduced motion. */
  still: boolean;
}

/** What a static effect is set to do. */
export interface StaticSettings extends Pick<StaticLook, "pixelSize" | "still"> {
  /** The proportion of blocks to reach. */
  proportion: number;
  /** How long it takes to reach the proportion, and to fade away. */
  easeMs: number;
  /** How long it lasts, including both, in milliseconds; undefined holds until it is stopped. */
  durationMs: number | undefined;
  /** The eased progress at each progress through the easing (0–1). */
  easing: (progress: number) => number;
}

/**
 * A player's static over time: it builds to its proportion, holds, and fades away, either at the end of its duration
 * or from when it is stopped.
 */
export class PlayerStatic {
  private readonly settings: StaticSettings;
  private readonly startedAt: number;
  private stoppedAt: number | undefined;

  /** @param now when it starts, in milliseconds */
  constructor(settings: StaticSettings, now: number) {
    this.settings = settings;
    this.startedAt = now;
  }

  /** Starts it fading away, if it hasn't an end already. */
  stop(now: number): void {
    this.stoppedAt ??= now;
  }

  /** How long until it has faded away after being stopped. */
  get easeMs(): number {
    return this.settings.easeMs;
  }

  /** What it looks like at a time, in milliseconds. */
  lookAt(now: number): StaticLook {
    const { pixelSize, still, proportion } = this.settings;
    return { pixelSize, still, proportion: proportion * this.strengthAt(now) };
  }

  /** How strong it is at a time, from 0 to 1: the least of how far it has built and how far it has yet to fade. */
  private strengthAt(now: number): number {
    const { easeMs, durationMs, easing } = this.settings;
    const eased = (ms: number) => (easeMs <= 0 ? 1 : easing(Math.min(Math.max(ms / easeMs, 0), 1)));
    const building = eased(now - this.startedAt);
    const fadingFrom = this.stoppedAt ?? (durationMs === undefined ? undefined : this.startedAt + durationMs - easeMs);
    return fadingFrom === undefined ? building : Math.min(building, eased(easeMs - (now - fadingFrom)));
  }
}
