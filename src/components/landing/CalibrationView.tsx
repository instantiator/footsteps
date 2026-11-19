import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router";
import { isDefined } from "../../util/ObjectUtils";
import { sizeOf } from "../camera/CameraChoice";
import CharacterCanvas from "../camera/CharacterCanvas";
import { calibrationOrDefault, cameraKeyOf, loadCalibration, saveCalibration } from "../camera/FloorCalibration";
import {
  CORNER_NAMES,
  DEFAULT_CORNERS,
  dragCorner,
  imageFractionOf,
  imagePointForScreenPoint,
  isOnFloor,
  type CornerName,
  type Corners,
} from "../camera/FloorGeometry";
import FloorOverlay from "../camera/FloorOverlay";
import type { PlayerFrame } from "../camera/PlayerMonitor";
import ButtonBar from "./ButtonBar";
import "./GamePanel.css";
import "./CalibrationView.css";
import ClearAllCalibrations from "./ClearAllCalibrations";
import PictureWarnings from "./PictureWarnings";
import PlanSpaceLink, { type PlannedCamera } from "./PlanSpaceLink";
import { useCameraPicker } from "./useCameraPicker";

/** The steps shown to the player, in order. */
const STEPS = [
  "Drag each blue corner to a corner of the space you can walk around in.",
  "Walk to each corner. Your feet should stay green.",
  "Press Save and close when it fits.",
];

/** How far an arrow key moves a corner, in image fractions; Shift moves it further. */
const KEY_STEP = 0.01;
const SHIFT_KEY_STEP = 0.05;

/** Which way each arrow key moves a corner on screen. */
const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** A corner's name as the player sees it: a mirrored picture shows the image's left on the right. */
const cornerLabel = (name: CornerName, mirrored: boolean): string => {
  const [depth, side] = name.startsWith("back") ? ["Back", name.slice(4)] : ["Front", name.slice(5)];
  const onScreen = mirrored ? (side === "Left" ? "right" : "left") : side.toLowerCase();
  return `${depth} ${onScreen} corner`;
};

/** Whether two sets of corners are the same. */
const sameCorners = (a: Corners, b: Corners | undefined): boolean =>
  isDefined(b) && CORNER_NAMES.every((name) => a[name].x === b[name].x && a[name].y === b[name].y);

/** Whether both of a player's feet are placed, and on the floor. */
const feetOnFloor = (player: PlayerFrame, corners: Corners): boolean =>
  [player.keyPoints.leftFoot, player.keyPoints.rightFoot].every(
    (foot) => foot !== null && isOnFloor(corners, imageFractionOf(foot, player)),
  );

/** The draggable, keyboard-movable corners, placed over the picture in image fractions. */
function CornerHandles({
  corners,
  mirrored,
  onMove,
}: {
  corners: Corners;
  mirrored: boolean;
  onMove: (name: CornerName, to: { x: number; y: number }) => void;
}) {
  const [dragging, setDragging] = useState<CornerName>();
  const onPointerMove = (name: CornerName) => (event: PointerEvent<HTMLButtonElement>) => {
    const picture = event.currentTarget.parentElement;
    if (dragging !== name || !picture) return;
    onMove(
      name,
      imagePointForScreenPoint({ x: event.clientX, y: event.clientY }, picture.getBoundingClientRect(), mirrored),
    );
  };
  const onKeyDown = (name: CornerName) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const arrow = ARROWS[event.key];
    if (!isDefined(arrow)) return;
    event.preventDefault();
    const step = (event.shiftKey ? SHIFT_KEY_STEP : KEY_STEP) * (mirrored ? -1 : 1);
    onMove(name, { x: corners[name].x + arrow.x * step, y: corners[name].y + arrow.y * Math.abs(step) });
  };
  return CORNER_NAMES.map((name) => (
    <button
      key={name}
      type="button"
      className="calibration-corner"
      aria-label={cornerLabel(name, mirrored)}
      style={{ left: `${corners[name].x * 100}%`, top: `${corners[name].y * 100}%` }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(name);
      }}
      onPointerMove={onPointerMove(name)}
      onPointerUp={() => setDragging(undefined)}
      onKeyDown={onKeyDown(name)}
    />
  ));
}

/** The chosen camera's corners as they are being changed, what is saved, and how far through the steps the player is. */
function useCalibration(cameraKey: string, players: PlayerFrame[]) {
  const [corners, setCorners] = useState(() => calibrationOrDefault(cameraKey));
  const [saved, setSaved] = useState(() => loadCalibration(cameraKey));
  const [moved, setMoved] = useState(false);
  const [seenOnFloor, setSeenOnFloor] = useState(false);
  const people = players.filter((player) => !isDefined(player.held));
  const onePerson = people.length <= 1;
  // Remember the first time the one player stands on the floor (see the React note on adjusting state while rendering)
  if (moved && !seenOnFloor && people.length === 1 && feetOnFloor(people[0], corners)) setSeenOnFloor(true);
  return {
    corners,
    // An uncalibrated configuration starts on the default corners, which aren't saved yet
    unsaved: !sameCorners(corners, saved),
    onePerson,
    step: !moved ? 0 : !seenOnFloor ? 1 : 2,
    move: (name: CornerName, to: { x: number; y: number }) => {
      setCorners((current) => dragCorner(current, name, to));
      setMoved(true);
    },
    reset: () => setCorners(DEFAULT_CORNERS),
    /** @returns whether the corners were saved */
    save: () => saveCalibration(cameraKey, corners),
    cleared: () => setSaved(undefined),
  };
}

/** The camera being calibrated, as the player knows it: its name, and its configuration's. */
const cameraNameOf = ({ choice, cameras, activeDeviceId, options }: ReturnType<typeof useCameraPicker>): string => {
  const { width, height } = sizeOf(choice);
  const camera = cameras.find(({ deviceId }) => deviceId === activeDeviceId)?.label || "the camera";
  const configuration = options.find((option) => option.width === width && option.height === height)?.name;
  return `${camera} · ${configuration ?? `${width}×${height}`}`;
};

/** The steps, with the current one marked, and a link to plan the space for this camera. */
function Steps({ step, camera }: { step: number; camera: PlannedCamera }) {
  return (
    <div className="game-panel calibration-steps">
      <ol>
        {STEPS.map((text, index) => (
          <li key={text} aria-current={index === step ? "step" : undefined}>
            {text}
          </li>
        ))}
      </ol>
      <PlanSpaceLink camera={camera} />
    </div>
  );
}

/** The bar along the bottom: leaving, starting again, clearing everything, and saving. */
function CalibrationBar({
  canSave,
  onClose,
  onReset,
  onCleared,
  onSave,
}: {
  canSave: boolean;
  onClose: () => void;
  onReset: () => void;
  onCleared: () => void;
  onSave: () => void;
}) {
  return (
    <ButtonBar
      start={
        <>
          <button type="button" className="game-button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="game-button" onClick={onReset}>
            Reset
          </button>
          <ClearAllCalibrations onCleared={onCleared} />
        </>
      }
      end={
        <button type="button" className="game-button" disabled={!canSave} onClick={onSave}>
          Save and close
        </button>
      }
    />
  );
}

/** Props for {@link CalibrationView}. */
interface CalibrationViewProps {
  /** Where Close and Save and close go: the game's landing page. */
  backTo: string;
  /** The game's title, for the page's title. */
  title: string;
  /** The game's background and font. */
  style?: CSSProperties;
}

/**
 * Lets the player mark the floor they can walk around in, for the chosen camera configuration: they drag the corners
 * over the camera picture, then walk the floor to check their feet stay on it. It expects one person in view.
 */
export default function CalibrationView({ backTo, title, style }: CalibrationViewProps) {
  const picker = useCameraPicker();
  const { choice, stream, cameras, activeDeviceId } = picker;
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [players, setPlayers] = useState<PlayerFrame[]>([]);
  const calibration = useCalibration(cameraKeyOf(choice), players);
  const { corners, onePerson, unsaved } = calibration;
  const label = cameras.find(({ deviceId }) => deviceId === activeDeviceId)?.label ?? "";

  // Share the video with the tracking once it exists, as the game's camera does
  useEffect(() => setVideo(videoRef.current), []);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  const close = () => {
    if (!unsaved || window.confirm("Close without saving the floor?")) navigate(backTo);
  };

  return (
    <main className="calibration" style={style}>
      <div className="calibration-content">
        <div className="calibration-side">
          <h1 className="game-panel calibration-title">
            <strong>{title}:</strong> Floor calibration
          </h1>
          <Steps step={calibration.step} camera={{ label, size: sizeOf(choice) }} />
        </div>
        <section className="game-panel calibration-panel" aria-labelledby="calibrating">
          <h2 id="calibrating">
            Calibrating: {cameraNameOf(picker)}
            {unsaved && <span title="Unsaved changes">*</span>}
          </h2>
          <div className="calibration-frame">
            <div className="calibration-picture" style={{ transform: choice.mirror ? "scaleX(-1)" : undefined }}>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- a live, silent picture of the room: nothing to caption */}
              <video ref={videoRef} aria-label="Camera picture" autoPlay muted playsInline />
              <FloorOverlay corners={corners} players={players} checkFeet={onePerson}>
                <CornerHandles corners={corners} mirrored={choice.mirror} onMove={calibration.move} />
              </FloorOverlay>
            </div>
            <PictureWarnings warnings={onePerson ? [] : ["Only one person should be in view to calibrate"]} />
          </div>
        </section>
      </div>
      <div hidden>
        <CharacterCanvas video={video} mediaStream={stream} onPlayersChange={setPlayers} />
      </div>
      <CalibrationBar
        canSave={onePerson}
        onClose={close}
        onReset={calibration.reset}
        onCleared={calibration.cleared}
        onSave={() => calibration.save() && navigate(backTo)}
      />
    </main>
  );
}
