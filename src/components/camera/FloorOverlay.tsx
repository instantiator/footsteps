import type { CSSProperties, ReactNode } from "react";
import { isDefined } from "../../util/ObjectUtils";
import type { KeyPointName, Point } from "../../vision/VisionTypes";
import { CORNER_NAMES, imageFractionOf, isOnFloor, type Corners } from "./FloorGeometry";
import "./FloorOverlay.css";
import type { PlayerFrame } from "./PlayerMonitor";

/** Props for {@link FloorOverlay}. */
interface FloorOverlayProps {
  /** The floor to outline; none if not given, and the feet aren't checked against it. */
  corners?: Corners;
  /** The people to mark: their head, hands and feet. */
  players?: PlayerFrame[];
  /** Whether each foot shows green on the floor and red off it; otherwise they are neutral. Defaults to true. */
  checkFeet?: boolean;
  /** Placed over the image box too, such as the calibration view's corner handles. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A marker on one body part, in image fractions. */
interface Marker {
  key: string;
  at: Point;
  className: string;
}

/** Where a key point is in image fractions, if the model placed it. */
const pointOf = (player: PlayerFrame, name: KeyPointName): Point | undefined => {
  const point = player.keyPoints[name];
  return point ? imageFractionOf(point, player) : undefined;
};

/** The middle of the head points the model placed, if any. */
const headOf = (player: PlayerFrame): Point | undefined => {
  const points = (["headTop", "headBottom", "headLeft", "headRight"] as const)
    .map((name) => pointOf(player, name))
    .filter(isDefined);
  if (points.length === 0) return undefined;
  const sum = points.reduce((total, { x, y }) => ({ x: total.x + x, y: total.y + y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

/** A player's head, hand and foot markers; each foot coloured by whether it is on the floor, when it is checked. */
const markersOf = (player: PlayerFrame, corners: Corners | undefined, checkFeet: boolean): Marker[] => {
  const held = isDefined(player.held) ? " floorMarkerHeld" : "";
  const footClass = (at: Point) =>
    !isDefined(corners) || !checkFeet ? "" : isOnFloor(corners, at) ? " floorMarkerOn" : " floorMarkerOff";
  const parts: [string, Point | undefined, (at: Point) => string][] = [
    ["head", headOf(player), () => " floorMarkerHead"],
    ["leftHand", pointOf(player, "leftHand"), () => ""],
    ["rightHand", pointOf(player, "rightHand"), () => ""],
    ["leftFoot", pointOf(player, "leftFoot"), footClass],
    ["rightFoot", pointOf(player, "rightFoot"), footClass],
  ];
  return parts.flatMap(([part, at, extra]) =>
    at ? [{ key: `${player.id}-${part}`, at, className: `floorMarker${extra(at)}${held}` }] : [],
  );
};

/**
 * Outlines the floor over a camera image, and marks each person's head, hands and feet, with each foot green on the
 * floor and red off it. It must be laid exactly over the image's box, with the image's mirroring, so it draws in image
 * fractions with no conversion. The calibration view and the debug view share it.
 */
export default function FloorOverlay({
  corners,
  players = [],
  checkFeet = true,
  children,
  className,
  style,
}: FloorOverlayProps) {
  return (
    <div className={`floorOverlay ${className ?? ""}`} style={style} data-testid="floor-overlay">
      {corners && (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={CORNER_NAMES.map((name) => `${corners[name].x},${corners[name].y}`).join(" ")} />
        </svg>
      )}
      {players
        .flatMap((player) => markersOf(player, corners, checkFeet))
        .map(({ key, at, className: markerClass }) => (
          <div key={key} className={markerClass} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }} />
        ))}
      {children}
    </div>
  );
}
