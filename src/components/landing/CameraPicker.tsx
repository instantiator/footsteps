import { useEffect, useRef, type RefObject } from "react";
import { Link } from "react-router";
import { sizeOf, type CameraChoice } from "../camera/CameraChoice";
import { cameraKeyOf, forgetCalibration, loadCalibration } from "../camera/FloorCalibration";
import type { Corners } from "../camera/FloorGeometry";
import FloorOverlay from "../camera/FloorOverlay";
import type { CameraOption } from "../camera/Webcams";
import { useCameraPicker } from "./useCameraPicker";

/** Marks the current choice in the dropdown. */
const MARK = "✓ ";

/** The camera dropdown's value for playing without the camera. */
const NO_CAMERA = "none";

/** The live preview, mirrored as chosen, with the floor over it when given and what's still needed on top. */
function CameraPreview({
  videoRef,
  mirror,
  corners,
  warnings,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirror: boolean;
  corners: Corners | undefined;
  warnings: string[] | undefined;
}) {
  const transform = mirror ? "scaleX(-1)" : undefined;
  return (
    <div className="game-camera-preview">
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- a live, silent preview of the player: nothing to caption */}
      <video ref={videoRef} aria-label="Camera preview" style={{ transform }} autoPlay muted playsInline />
      {corners && <FloorOverlay corners={corners} style={{ transform }} />}
      {warnings && warnings.length > 0 && (
        <ul className="game-camera-warnings">
          {warnings.map((warning) => (
            <li key={warning}>
              <span aria-hidden="true">⚠️ </span>
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const sizeKey = ({ width, height }: { width: number; height: number }) => `${width}x${height}`;

/** A choice of the sizes the camera can be opened at, shown only when there's more than one. */
function SizeChoice({
  options,
  choice,
  choose,
}: {
  options: CameraOption[];
  choice: CameraChoice;
  choose: (change: Partial<CameraChoice>) => void;
}) {
  if (options.length < 2) return null;
  return (
    <label>
      Configuration
      <select
        value={sizeKey(sizeOf(choice))}
        onChange={({ target }) => {
          const chosen = options.find((option) => sizeKey(option) === target.value);
          choose({ size: chosen && { width: chosen.width, height: chosen.height } });
        }}
      >
        {options.map((option) => (
          <option key={sizeKey(option)} value={sizeKey(option)}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Props for {@link CameraPicker}. */
interface CameraPickerProps {
  /** Whether the camera may be opened, as it is granted; true if omitted. */
  granted?: boolean;
  /** Where to calibrate the floor, for a game with 2.5D scenes; the floor isn't shown if not given. */
  calibrateTo?: string;
  /** Called with the chosen camera's calibration key, now and whenever it changes. Keep it stable. */
  onCameraKeyChange?: (cameraKey: string) => void;
  /** Called once the chosen configuration's calibration has been forgotten. */
  onCalibrationForgotten?: () => void;
  /** Playing without the camera, offered in the camera dropdown for a game that can. */
  noCamera?: { checked: boolean; onChange: (checked: boolean) => void };
  /** What's still needed before the game can begin, shown over the preview. */
  warnings?: string[];
}

/**
 * Lets the player choose a camera, its configuration and whether to mirror it, with a live preview of the result. For
 * a game with 2.5D scenes, the preview shows the configuration's floor once it's calibrated, with buttons to calibrate
 * it and to forget it.
 */
export default function CameraPicker({
  granted = true,
  calibrateTo,
  onCameraKeyChange,
  onCalibrationForgotten,
  noCamera,
  warnings,
}: CameraPickerProps) {
  const withoutCamera = noCamera?.checked === true;
  const { choice, choose, cameras, stream, failed, activeDeviceId, options } = useCameraPicker(
    granted && !withoutCamera,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraKey = cameraKeyOf(choice);
  const calibration = calibrateTo ? loadCalibration(cameraKey) : undefined;

  useEffect(() => onCameraKeyChange?.(cameraKey), [cameraKey, onCameraKeyChange]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className="game-camera-picker">
      <div className="game-camera-choices">
        <CameraSelect
          choice={choice}
          cameras={cameras}
          activeDeviceId={activeDeviceId}
          noCamera={noCamera}
          onChoose={(deviceId) => choose({ deviceId, size: undefined })}
        />
        {!withoutCamera && <SizeChoice options={options} choice={choice} choose={choose} />}
      </div>
      <label>
        <input type="checkbox" checked={choice.mirror} onChange={({ target }) => choose({ mirror: target.checked })} />
        Mirror picture (for a camera facing the player)
      </label>
      {failed && <p role="alert">This camera could not start. It may be in use by another app.</p>}
      <div className="game-camera-row">
        <CameraPreview videoRef={videoRef} mirror={choice.mirror} corners={calibration} warnings={warnings} />
        {calibrateTo && !withoutCamera && (
          <FloorActions
            calibrateTo={calibrateTo}
            calibrated={calibration !== undefined}
            onForget={() => {
              forgetCalibration(cameraKey);
              onCalibrationForgotten?.();
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Buttons to calibrate the configuration's floor, and to forget its calibration. */
function FloorActions({
  calibrateTo,
  calibrated,
  onForget,
}: {
  calibrateTo: string;
  calibrated: boolean;
  onForget: () => void;
}) {
  return (
    <div className="game-camera-floor-actions">
      <Link className="game-button" to={calibrateTo}>
        Calibrate
      </Link>
      <button type="button" className="game-button" disabled={!calibrated} onClick={onForget}>
        Reset
      </button>
    </div>
  );
}

/** The camera dropdown: the system default, each camera the browser lists, and playing without one where offered. */
function CameraSelect({
  choice,
  cameras,
  activeDeviceId,
  noCamera,
  onChoose,
}: {
  choice: CameraChoice;
  cameras: MediaDeviceInfo[];
  activeDeviceId: string | undefined;
  noCamera: CameraPickerProps["noCamera"];
  onChoose: (deviceId: string | undefined) => void;
}) {
  const labelOf = ({ label }: MediaDeviceInfo, index: number) => label || `Camera ${index + 1}`;
  const defaultCamera = cameras.find(({ deviceId }) => deviceId === activeDeviceId) ?? cameras[0];
  const defaultName = defaultCamera ? ` (${labelOf(defaultCamera, cameras.indexOf(defaultCamera))})` : "";
  const value = noCamera?.checked ? NO_CAMERA : (choice.deviceId ?? "");
  const mark = (option: string) => (value === option ? MARK : "");

  return (
    <label>
      Camera
      <select
        value={value}
        onChange={({ target }) => {
          noCamera?.onChange(target.value === NO_CAMERA);
          if (target.value !== NO_CAMERA) onChoose(target.value === "" ? undefined : target.value);
        }}
      >
        <option value="">
          {mark("")}System default{value === "" ? defaultName : ""}
        </option>
        {cameras.map((camera, index) => (
          <option key={camera.deviceId} value={camera.deviceId}>
            {mark(camera.deviceId)}
            {labelOf(camera, index)}
          </option>
        ))}
        {noCamera && <option value={NO_CAMERA}>{mark(NO_CAMERA)}Play without the camera</option>}
      </select>
    </label>
  );
}
