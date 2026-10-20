import { useGameData } from "../../providers/GameDataHook";
import { useGameState } from "../../providers/GameStateHook";

/** Side-by-side pretty-printed JSON of the current game data and game state, for debugging. */
export default function GameJson() {
  const { gameData } = useGameData();
  const { gameState } = useGameState();

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: "1rem",
        }}
      >
        <div style={{ flexGrow: 1 }}>
          <h1>Game data</h1>
          <pre>{JSON.stringify(gameData, null, 2)}</pre>
        </div>
        <div style={{ flexGrow: 1 }}>
          <h1>Game state</h1>
          <pre>{JSON.stringify(gameState, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}
