import { useEffect, useRef, type RefObject } from "react";
import { Link } from "react-router";
import { calibrationOrDefault, cameraKeyOf, isCalibrated } from "../camera/FloorCalibration";
import type { Corners } from "../camera/FloorGeometry";
import FloorOverlay from "../camera/FloorOverlay";
import { useCameraPicker } from "./useCameraPicker";

/** Marks the current choice in the dropdown. */
const MARK = "✓ ";

/** The live preview, mirrored as chosen, with the floor over it when given. */
function CameraPreview({
  videoRef,
  mirror,
  corners,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirror: boolean;
  corners: Corners | undefined;
}) {
  const transform = mirror ? "scaleX(-1)" : undefined;
  return (
    <div className="game-camera-preview">
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- a live, silent preview of the player: nothing to caption */}
      <video ref={videoRef} aria-label="Camera preview" style={{ transform }} autoPlay muted playsInline />
      {corners && <FloorOverlay corners={corners} style={{ transform }} />}
    </div>
  );
}

/** Whether the chosen camera has a saved floor, and a link to calibrate it. */
function FloorStatus({ cameraKey, calibrateTo }: { cameraKey: string; calibrateTo: string }) {
  return (
    <p>
      {isCalibrated(cameraKey) ? "This camera has a saved floor area. " : "This camera has no saved floor area yet. "}
      <Link to={calibrateTo}>Calibrate the floor</Link>
    </p>
  );
}

/** Props for {@link CameraPicker}. */
interface CameraPickerProps {
  /** Where to calibrate the floor, for a game with 2.5D scenes; the floor isn't shown if not given. */
  calibrateTo?: string;
  /** Called with the chosen camera's calibration key, now and whenever it changes. Keep it stable. */
  onCameraKeyChange?: (cameraKey: string) => void;
}

/**
 * Lets the player choose a camera and whether to mirror it, with a live preview of the result. For a game with 2.5D
 * scenes, the preview shows the camera's floor, with whether it has been calibrated and a link to calibrate it.
 */
export default function CameraPicker({ calibrateTo, onCameraKeyChange }: CameraPickerProps) {
  const { choice, choose, cameras, stream, failed, activeDeviceId } = useCameraPicker();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraKey = cameraKeyOf(choice);
  const floorCorners = calibrateTo ? calibrationOrDefault(cameraKey) : undefined;

  useEffect(() => onCameraKeyChange?.(cameraKey), [cameraKey, onCameraKeyChange]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  const labelOf = ({ label }: MediaDeviceInfo, index: number) => label || `Camera ${index + 1}`;
  const defaultCamera = cameras.find(({ deviceId }) => deviceId === activeDeviceId) ?? cameras[0];
  const defaultName = defaultCamera ? ` (${labelOf(defaultCamera, cameras.indexOf(defaultCamera))})` : "";

  return (
    <div className="game-camera-picker">
      <label>
        Camera
        <select
          value={choice.deviceId ?? ""}
          onChange={({ target }) => choose({ deviceId: target.value === "" ? undefined : target.value })}
        >
          <option value="">
            {choice.deviceId === undefined ? MARK : ""}System default{choice.deviceId === undefined ? defaultName : ""}
          </option>
          {cameras.map((camera, index) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {choice.deviceId === camera.deviceId ? MARK : ""}
              {labelOf(camera, index)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={choice.mirror} onChange={({ target }) => choose({ mirror: target.checked })} />
        Mirror picture (for a camera facing the player)
      </label>
      {failed && <p role="alert">This camera could not start. It may be in use by another app.</p>}
      <CameraPreview videoRef={videoRef} mirror={choice.mirror} corners={floorCorners} />
      {calibrateTo && <FloorStatus cameraKey={cameraKey} calibrateTo={calibrateTo} />}
    </div>
  );
}
