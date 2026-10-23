import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { useGameData } from "../../providers/GameDataHook";
import { isDefined } from "../../util/ObjectUtils";
import GameStylesheets from "../core/GameStylesheets";
import "./GamePanel.css";
import "./GameLanding.css";

/** The game's landing page: its tile graphic behind the game's title, description and controls. */
export default function GameLanding() {
  const { gameId, gameData, resources } = useGameData();
  const navigate = useNavigate();
  const graphic = useMemo(
    () => (isDefined(gameData.tileGraphic) ? resources[gameData.tileGraphic] : undefined),
    [gameData.tileGraphic, resources],
  );

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
      </div>
      <div className="game-landing-actions">
        <button type="button" onClick={() => navigate(`/game/${gameId}/play`)}>
          New game
        </button>
      </div>
    </div>
  );
}
