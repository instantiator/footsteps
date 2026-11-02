import { useEffect, useRef } from "react";
import { useCameraPicker } from "./useCameraPicker";

/** Marks the current choice in the dropdown. */
const MARK = "✓ ";

/** Lets the player choose a camera and whether to mirror it, with a live preview of the result. */
export default function CameraPicker() {
  const { choice, choose, cameras, stream, failed, activeDeviceId } = useCameraPicker();
  const videoRef = useRef<HTMLVideoElement>(null);

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
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- a live, silent preview of the player: nothing to caption */}
      <video
        ref={videoRef}
        aria-label="Camera preview"
        style={{ transform: choice.mirror ? "scaleX(-1)" : undefined }}
        autoPlay
        muted
        playsInline
      />
    </div>
  );
}
