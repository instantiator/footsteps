import { useMemo, useReducer, useState, type ComponentProps, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import type { GameData } from "../../entities/data/GameData";
import { clearGameState, loadGameState } from "../../entities/state/GameStateStorage";
import { useGameData } from "../../providers/GameDataHook";
import { isDefined } from "../../util/ObjectUtils";
import { loadCameraChoice, sizeOf } from "../camera/CameraChoice";
import { cameraKeyOf } from "../camera/FloorCalibration";
import GameStylesheets from "../core/GameStylesheets";
import { calibrationNeeded, gameCameraRequirement, gameUsesFloor } from "../core/logic/GamePermissionUtils";
import "./GamePanel.css";
import "./GameLanding.css";
import CameraPicker, { type CameraInUse } from "./CameraPicker";
import GameBadges from "./GameBadges";
import GamePermissionPanel from "./GamePermissionPanel";
import { useGamePermissions } from "./useGamePermissions";

/** The bar along the bottom: planning the space in a new tab, and starting the game. */
function ActionBar({
  planTo,
  saved,
  ready,
  onContinue,
  onNewGame,
}: {
  planTo: string;
  saved: boolean;
  ready: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}) {
  return (
    <div className="game-landing-actions">
      <Link className="game-button" to={planTo} target="_blank" rel="noreferrer">
        Plan space
      </Link>
      <span className="game-landing-actions-gap" />
      {saved && (
        <button type="button" className="game-button" disabled={!ready} onClick={onContinue}>
          Continue
        </button>
      )}
      <button type="button" className="game-button" disabled={!ready} onClick={onNewGame}>
        New game
      </button>
    </div>
  );
}

/** The camera's configuration, in its own panel. */
function CameraPanel(props: ComponentProps<typeof CameraPicker>) {
  return (
    <section className="game-panel game-landing-panel" aria-labelledby="camera-configuration">
      <h2 id="camera-configuration">Camera configuration</h2>
      <CameraPicker {...props} />
    </section>
  );
}

/** The setup planner, for the camera in use once the browser has named it, so it starts with that camera's view. */
const planPath = (camera: CameraInUse | undefined): string => {
  if (!camera?.label) return "/setup";
  const { label, size } = camera;
  return `/setup?${new URLSearchParams({ camera: label, size: `${size.width}x${size.height}` }).toString()}`;
};

/**
 * Whether the camera is ready to play: granted where it's required, and calibrated where the game uses the floor, unless
 * the player plays without it. What's still needed is given as warnings for the preview.
 */
const useCameraReadiness = (gameData: GameData, cameraGranted: boolean, canStart: boolean) => {
  const [camera, setCamera] = useState<CameraInUse>(() => {
    const choice = loadCameraChoice();
    return { key: cameraKeyOf(choice), label: "", size: sizeOf(choice) };
  });
  // Calibrations live in storage, so resetting or clearing one re-renders to read it again
  const [, calibrationChanged] = useReducer((count: number) => count + 1, 0);
  const [noCamera, setNoCamera] = useState(false);
  const needsCalibration = !noCamera && calibrationNeeded(gameData, cameraGranted, camera.key);
  const warnings = [!canStart && "Camera required", needsCalibration && "Not yet calibrated"].filter(
    (warning) => typeof warning === "string",
  );
  const ready = canStart && !needsCalibration;
  const planTo = planPath(noCamera ? undefined : camera);
  return { setCamera, calibrationChanged, noCamera, setNoCamera, ready, warnings, planTo };
};

/**
 * The game's landing page: its tile graphic behind the game's title and details, the permissions and the camera's
 * configuration, over a bar of buttons to plan the space and to start.
 */
export default function GameLanding() {
  const { gameId, gameData, resources } = useGameData();
  const navigate = useNavigate();
  const graphic = useMemo(
    () => (isDefined(gameData.tileGraphic) ? resources[gameData.tileGraphic] : undefined),
    [gameData.tileGraphic, resources],
  );
  const { permissions, states, granting, grant, canStart } = useGamePermissions(gameData);
  const savedState = useMemo(() => loadGameState(gameId, gameData), [gameId, gameData]);
  const cameraRequirement = gameCameraRequirement(gameData);
  const cameraGranted = states.camera === "granted";
  const readiness = useCameraReadiness(gameData, cameraGranted, canStart);
  const { noCamera, ready } = readiness;
  const playPath = `/game/${gameId}/play${noCamera ? "?noCamera=true" : ""}`;

  const startNewGame = () => {
    if (isDefined(savedState) && !window.confirm("Start a new game? The saved game will be lost.")) return;
    clearGameState(gameId);
    navigate(playPath);
  };

  const pageStyle: CSSProperties = {
    backgroundImage: isDefined(graphic) ? `url("${graphic}")` : undefined,
    fontFamily: gameData.gameContainerStyle.fontFamily,
  };

  return (
    <div className="game-landing" style={pageStyle}>
      <GameStylesheets />
      <div className="game-landing-content">
        <div className="game-panel game-landing-panel game-landing-title">
          <h1>{gameData.title}</h1>
          <GameBadges gameData={gameData} saved={savedState} />
          <p>{gameData.description}</p>
        </div>
        {permissions.length > 0 && (
          <div className="game-landing-side">
            <GamePermissionPanel permissions={permissions} states={states} granting={granting} onGrant={grant} />
            {cameraRequirement && (
              <CameraPanel
                granted={cameraGranted}
                calibrateTo={gameUsesFloor(gameData) ? `/game/${gameId}/calibrate` : undefined}
                onCameraChange={readiness.setCamera}
                onCalibrationChange={readiness.calibrationChanged}
                noCamera={
                  cameraRequirement === "enabled" ? { checked: noCamera, onChange: readiness.setNoCamera } : undefined
                }
                warnings={readiness.warnings}
              />
            )}
          </div>
        )}
      </div>
      <ActionBar
        planTo={readiness.planTo}
        saved={isDefined(savedState)}
        ready={ready}
        onContinue={() => navigate(playPath)}
        onNewGame={startNewGame}
      />
    </div>
  );
}
