import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { clearGameState, loadGameState } from "../../entities/state/GameStateStorage";
import { useGameData } from "../../providers/GameDataHook";
import { isDefined } from "../../util/ObjectUtils";
import GameStylesheets from "../core/GameStylesheets";
import "./GamePanel.css";
import "./GameLanding.css";
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
  const { permissions, states, granting, grant, allGranted } = useGamePermissions(gameData);
  const savedState = useMemo(() => loadGameState(gameId, gameData), [gameId, gameData]);

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
        <GamePermissionPanel permissions={permissions} states={states} granting={granting} onGrant={grant} />
      </div>
      <div className="game-landing-actions">
        {isDefined(savedState) && (
          <button type="button" disabled={!allGranted} onClick={() => navigate(`/game/${gameId}/play`)}>
            Continue
          </button>
        )}
        <button type="button" disabled={!allGranted} onClick={startNewGame}>
          New game
        </button>
      </div>
    </div>
  );
}
