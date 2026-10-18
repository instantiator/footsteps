import type { CSSProperties } from "react";
import { isDefined } from "../../util/ObjectUtils";
import type { FeetPositions } from "../camera/CameraSupport";

interface CameraDebugOverlayProps {
  className?: string;
  style?: CSSProperties;
  feetPositions?: FeetPositions;
}

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
