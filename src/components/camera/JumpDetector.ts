import type { AppConfig } from "../../config/AppConfig";

/** What counts as a jump. Distances are fractions of the player's height, so a child far away jumps like an adult. */
export interface JumpSettings {
  /** How far the feet must rise above the ground they stood on. */
  minRise: number;
  /** How far the feet may wander while standing, eg. from the model's foot-placement jitter. */
  still: number;
  /** How long the feet must be on the ground before a take-off counts, in milliseconds. */
  minGroundedMs: number;
  /** The longest the feet may still be rising after leaving the ground, in milliseconds. */
  maxRiseMs: number;
  /** The longest a jump may take from leaving the ground to landing, in milliseconds. */
  maxAirtimeMs: number;
  /** How much of the rise the feet must come back down to land. */
  minDescent: number;
}

/** The jump settings from the app config. */
export const jumpSettingsOf = (config: AppConfig): JumpSettings => ({
  minRise: config.jumpMinRise,
  still: config.jumpStill,
  minGroundedMs: config.jumpMinGroundedMs,
  maxRiseMs: config.jumpMaxRiseMs,
  maxAirtimeMs: config.jumpMaxAirtimeMs,
  minDescent: config.jumpMinDescent,
});

/** A jump in progress. Heights are the feet's y in mask pixels, so up is smaller. */
interface Flight {
  /** When the feet were last on the ground, in milliseconds. */
  leftGroundAt: number;
  /** The ground the feet left. */
  ground: number;
  /** The highest the feet have been. */
  peak: number;
}

/** What one frame meant for a jump. */
export type JumpEvent = "takeoff" | "landed";

/**
 * Follows one player's feet for jumps: standing on the ground, rising by at least `minRise`, then coming back down by
 * at least `minDescent` of the rise, within `maxAirtimeMs`. Sideways motion is ignored.
 *
 * It measures how far the feet move, not how fast, so a jump seen in only two or three frames still counts. The
 * feet's height in the image also changes as a player walks towards or away from the camera: stepping back looks like
 * a rise that never comes down, so it is abandoned; stepping forward is a fall with no rise, so it is ignored.
 */
export class JumpDetector {
  private readonly settings: JumpSettings;
  /** The feet's height while standing, or undefined until they are seen standing. */
  private ground: number | undefined;
  /** When the feet started standing on {@link ground}. */
  private groundedSince = 0;
  /** When the feet were last within {@link JumpSettings.still} of the ground. */
  private lastGroundedAt = 0;
  private flight: Flight | undefined;

  /** @param settings what counts as a jump */
  constructor(settings: JumpSettings) {
    this.settings = settings;
  }

  /** Whether the player is in the air: from take-off until they land, or the jump is abandoned. */
  get airborne(): boolean {
    return this.flight !== undefined;
  }

  /**
   * Follows the feet for one frame.
   * @param feetY the lower foot's height in mask pixels, or null when the feet weren't seen
   * @param bodyHeight the player's height in mask pixels, which distances are measured against
   * @param timestamp when the frame was taken, in milliseconds
   * @returns "takeoff" on the frame a jump starts, "landed" on the frame it completes
   */
  update(feetY: number | null, bodyHeight: number, timestamp: number): JumpEvent | undefined {
    if (this.flight) return feetY === null ? undefined : this.fly(this.flight, feetY, timestamp);
    if (feetY === null) {
      this.ground = undefined; // standing starts again once the feet are back
      return undefined;
    }
    return this.stand(feetY, bodyHeight, timestamp);
  }

  /** Follows feet that are on the ground, or have risen without taking off yet. */
  private stand(feetY: number, bodyHeight: number, timestamp: number): JumpEvent | undefined {
    const { minRise, still, minGroundedMs, maxRiseMs } = this.settings;
    if (this.ground === undefined || feetY > this.ground) return this.settle(feetY, timestamp);

    const rise = this.ground - feetY;
    if (rise <= still * bodyHeight) {
      this.lastGroundedAt = timestamp;
      return undefined;
    }
    if (rise >= minRise * bodyHeight && this.lastGroundedAt - this.groundedSince >= minGroundedMs) {
      this.flight = { leftGroundAt: this.lastGroundedAt, ground: this.ground, peak: feetY };
      return "takeoff";
    }
    // Risen a little for a while without taking off: they stepped back, and stand there now
    if (timestamp - this.lastGroundedAt > maxRiseMs) this.settle(feetY, timestamp);
    return undefined;
  }

  /** Follows feet in the air: tracks the peak, and lands them once they have come down far enough. */
  private fly(flight: Flight, feetY: number, timestamp: number): JumpEvent | undefined {
    const { maxRiseMs, maxAirtimeMs, minDescent } = this.settings;
    const sinceLeaving = timestamp - flight.leftGroundAt;
    const stillRising = feetY < flight.peak;
    if (sinceLeaving > maxAirtimeMs || (stillRising && sinceLeaving > maxRiseMs)) {
      this.settle(feetY, timestamp); // too slow for a jump: wherever they are now is the ground
      return undefined;
    }
    if (stillRising) {
      flight.peak = feetY;
      return undefined;
    }
    if (feetY - flight.peak < minDescent * (flight.ground - flight.peak)) return undefined;
    this.settle(feetY, timestamp);
    return "landed";
  }

  /** Stands the feet on the ground where they are now. */
  private settle(feetY: number, timestamp: number): undefined {
    if (this.ground === undefined || this.flight) this.groundedSince = timestamp;
    this.flight = undefined;
    this.ground = feetY;
    this.lastGroundedAt = timestamp;
    return undefined;
  }
}
