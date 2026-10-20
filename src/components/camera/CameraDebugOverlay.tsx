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

/** Marks the position of each person's feet over the camera layer, to check the tracking. */
export default function CameraDebugOverlay({ className, style, feetPositions }: CameraDebugOverlayProps) {
  return (
    <>
      <div className={className} style={style}>
        {isDefined(feetPositions) &&
          Object.values(feetPositions).map((pos, i) => (
            <div
              key={`foot-marker-${i}`}
              style={{
                position: "absolute",
                left: `${pos.percent.x}%`,
                top: `${pos.percent.y}%`,
                width: "10px",
                height: "10px",
                backgroundColor: "lightgreen",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
      </div>
    </>
  );
}
