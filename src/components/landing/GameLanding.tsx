import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { clearGameState, loadGameState } from "../../entities/state/GameStateStorage";
import { useGameData } from "../../providers/GameDataHook";
import { isDefined } from "../../util/ObjectUtils";
import { loadCameraChoice } from "../camera/CameraChoice";
import { cameraKeyOf } from "../camera/FloorCalibration";
import GameStylesheets from "../core/GameStylesheets";
import { calibrationNeeded, gameUsesFloor } from "../core/logic/GamePermissionUtils";
import "./GamePanel.css";
import "./GameLanding.css";
import CameraPicker from "./CameraPicker";
import GamePermissionPanel from "./GamePermissionPanel";
import { useGamePermissions } from "./useGamePermissions";

/** The game's landing page: its tile graphic behind the game's title, description and controls. */
export default function GameLanding() {
  const { gameId, gameData, resources } = useGameData();
  const navigate = useNavigate();
  const graphic = useMemo(
    () => (isDefined(gameData.tileGraphic) ? resources[gameData.tileGraphic] : undefined),
    [gameData.tileGraphic, resources],
  );
  const { permissions, states, granting, grant, canStart } = useGamePermissions(gameData);
  const savedState = useMemo(() => loadGameState(gameId, gameData), [gameId, gameData]);
  const [cameraKey, setCameraKey] = useState(() => cameraKeyOf(loadCameraChoice()));
  const needsCalibration = calibrationNeeded(gameData, states.camera === "granted", cameraKey);
  const ready = canStart && !needsCalibration;

  const startNewGame = () => {
    clearGameState(gameId);
    navigate(`/game/${gameId}/play`);
  };

  const pageStyle: CSSProperties = {
    backgroundImage: isDefined(graphic) ? `url("${graphic}")` : undefined,
    fontFamily: gameData.gameContainerStyle.fontFamily,
  };

  return (
    <div className="game-landing" style={pageStyle}>
      <GameStylesheets />
      <div className="game-landing-content">
        <div className="game-panel game-landing-panel">
          <h1>{gameData.title}</h1>
          <p>{gameData.description}</p>
        </div>
        <GamePermissionPanel permissions={permissions} states={states} granting={granting} onGrant={grant}>
          {states.camera === "granted" && (
            <CameraPicker
              calibrateTo={gameUsesFloor(gameData) ? `/game/${gameId}/calibrate` : undefined}
              onCameraKeyChange={setCameraKey}
            />
          )}
        </GamePermissionPanel>
      </div>
      <div className="game-landing-actions">
        {needsCalibration && <p className="game-panel">Calibrate the floor before you start.</p>}
        {isDefined(savedState) && (
          <button type="button" disabled={!ready} onClick={() => navigate(`/game/${gameId}/play`)}>
            Continue
          </button>
        )}
        <button type="button" disabled={!ready} onClick={startNewGame}>
          New game
        </button>
      </div>
    </div>
  );
}
