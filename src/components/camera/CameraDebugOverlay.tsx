import type { CSSProperties } from "react";
import { isDefined } from "../../util/ObjectUtils";
import type { FeetPositions } from "../camera/CameraSupport";

/** Props for {@link CameraDebugOverlay}. */
interface CameraDebugOverlayProps {
  className?: string;
  style?: CSSProperties;
  /** Where to place a marker for each person; none if undefined. */
  feetPositions?: FeetPositions;
}

/** A seen player's feet are a solid dot; a held player's (where they were last seen) a faded ring. */
const markerStyle = (held: boolean | undefined): CSSProperties =>
  held === true ? { border: "2px solid lightgreen", opacity: 0.5 } : { backgroundColor: "lightgreen" };

/**
 * Marks the position of each person's feet over the camera layer, to check the tracking. A player the model has lost
 * for a moment, and is holding, is marked differently.
 */
export default function CameraDebugOverlay({ className, style, feetPositions }: CameraDebugOverlayProps) {
  return (
    <>
      <div className={className} style={style}>
        {isDefined(feetPositions) &&
          Object.values(feetPositions).map((pos, i) => (
            <div
              key={`foot-marker-${i}`}
              className={pos.held === true ? "foot-marker foot-marker-held" : "foot-marker"}
              style={{
                position: "absolute",
                left: `${pos.percent.x}%`,
                top: `${pos.percent.y}%`,
                width: "10px",
                height: "10px",
                ...markerStyle(pos.held),
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
      </div>
    </>
  );
}
