import { useParams } from "react-router";
import GameStylesheets from "../components/core/GameStylesheets";
import CalibrationView from "../components/landing/CalibrationView";
import { useGamePageStyle } from "../components/landing/GamePageStyle";
import type { GameId } from "../entities/data/GameData";
import AppConfigProvider from "../providers/AppConfigProvider";
import { useGameData } from "../providers/GameDataHook";
import { GameDataProvider } from "../providers/GameDataProvider";
import GameRepositoryProvider from "../providers/GameRepositoryProvider";

/** The calibration page in the game's own title, background and font. */
function GameCalibration() {
  const { gameId, gameData } = useGameData();
  return (
    <>
      <GameStylesheets />
      <CalibrationView backTo={`/game/${gameId}`} title={gameData.title} style={useGamePageStyle()} />
    </>
  );
}

/** Calibrates the floor for the chosen camera, opened from the landing page of the game with the id in the route. */
export default function LocalCalibrate() {
  const { id } = useParams();
  return (
    <AppConfigProvider>
      <GameRepositoryProvider source={{ type: "LocalRepository", path: "game-repository.json" }}>
        <GameDataProvider id={id as GameId}>
          <GameCalibration />
        </GameDataProvider>
      </GameRepositoryProvider>
    </AppConfigProvider>
  );
}
