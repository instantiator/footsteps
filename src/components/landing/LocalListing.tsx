import { useContext } from "react";
import { GameRepositoryContext } from "../../providers/GameRepositoryContext";
import GameTile from "./GameTile";

/** The local repository's status while it loads or if it fails, and once ready a tile for each of its games. */
export default function LocalListing() {
  const { repository } = useContext(GameRepositoryContext);

  return (
    <>
      {!repository.ready && <p>Status: {repository.error ?? "Loading..."}</p>}
      {repository.ready && (
        <div
          style={{
            display: "grid",
            // Tiles at least 14rem wide, unless the panel itself is narrower
            gridTemplateColumns: "repeat(auto-fill, minmax(min(14rem, 100%), 1fr))",
            gap: "1rem",
          }}
        >
          {Object.entries(repository.games).map(([gameId, gameData]) => (
            <GameTile key={`game-key-${gameId}`} gameId={gameId} gameData={gameData} />
          ))}
        </div>
      )}
    </>
  );
}
