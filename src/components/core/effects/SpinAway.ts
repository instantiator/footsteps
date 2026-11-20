import type { GameSpinAwayOptions } from "../../../entities/data/scenes/GameEffectData";
import type { ScreenPoint } from "./EffectTargets";

/** A size on screen. */
export interface ScreenSize {
  /** Across. */
  width: number;
  /** Down. */
  height: number;
}

/**
 * How far something must travel in a direction to be fully off the scene, centre first.
 * @param centre where its centre is, with the scene's top left at 0, 0
 * @param radius the furthest any of it reaches from its centre, as it arrives, allowing for zoom and rotation
 * @param degrees 0 is straight up, 90 is right, and -90 is left
 */
export const offscreenDistance = (
  centre: ScreenPoint,
  radius: number,
  degrees: number,
  { width, height }: ScreenSize,
): number => {
  const radians = (degrees * Math.PI) / 180;
  const across = Math.sin(radians);
  const down = -Math.cos(radians);
  const toEdge = (from: number, size: number, direction: number) => {
    if (direction === 0) return Infinity;
    return ((direction > 0 ? size - from : from) + radius) / Math.abs(direction);
  };
  return Math.min(toEdge(centre.x, width, across), toEdge(centre.y, height, down));
};

/** Which way something spins away, and how far it turns. */
export interface SpinAwayPath {
  /** The direction it leaves in: 0 is straight up, 90 is right, and -90 is left. */
  degrees: number;
  /** How far it turns on the way, in degrees; negative is anticlockwise. */
  turn: number;
}

/** The direction something spins away in, and how far it turns, picked at random within its options. */
export const spinAwayPath = (
  { angle, rotations = 2 }: GameSpinAwayOptions,
  random: () => number = Math.random,
): SpinAwayPath => {
  const { min, max } = angle ?? { min: -60, max: 60 };
  const degrees = min + random() * (max - min);
  const turn = rotations * 360 * (random() < 0.5 ? -1 : 1);
  return { degrees, turn };
};

/**
 * The movement of a spin away, from rest: `distance` pixels in the direction of `degrees`, turning `turn` degrees and
 * growing to `zoom`. Callers add how it fades.
 */
export const spinAwayKeyframes = (degrees: number, turn: number, distance: number, zoom: number): Keyframe[] => {
  const radians = (degrees * Math.PI) / 180;
  return [
    { translate: "0 0", rotate: "0deg", scale: "1" },
    {
      translate: `${Math.sin(radians) * distance}px ${-Math.cos(radians) * distance}px`,
      rotate: `${turn}deg`,
      scale: String(zoom),
    },
  ];
};
