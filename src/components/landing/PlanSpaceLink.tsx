import { Link } from "react-router";
import type { CameraSize } from "../camera/CameraChoice";

/** A camera to plan the space for: the name the browser gives it, and the size it is opened at. */
export interface PlannedCamera {
  /** The browser's name for it; empty until the browser names it. */
  label: string;
  /** The size it is opened at. */
  size: CameraSize;
}

/** The setup planner, for the camera once the browser has named it, so it starts with that camera's view. */
const planPath = (camera: PlannedCamera | undefined): string => {
  if (!camera?.label) return "/setup";
  const { label, size } = camera;
  return `/setup?${new URLSearchParams({ camera: label, size: `${size.width}x${size.height}` }).toString()}`;
};

/** **Plan space**: the setup planner in a new tab, for the camera in use where there is one. */
export default function PlanSpaceLink({ camera }: { camera?: PlannedCamera }) {
  return (
    <Link className="game-button" to={planPath(camera)} target="_blank" rel="noreferrer">
      Plan space
    </Link>
  );
}
