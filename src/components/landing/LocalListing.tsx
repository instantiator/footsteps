import { useContext } from "react";
import { Link } from "react-router-dom";
import { GameRepositoryContext } from "../../providers/GameRepositoryContext";

export default function LocalListing() {
  const { repository } = useContext(GameRepositoryContext);

  return (
    <>
      <p>Status: {repository.ready ? "Ready" : (repository.error ?? "Loading...")}</p>
      {repository.ready && (
        <ul>
          {Object.entries(repository.games).map(([gameId, gameData]) => (
            <li key={`game-key-${gameId}`}>
              <Link to={`/game/${gameId}`}>
                <b>{gameData.title}</b>
              </Link>{" "}
              (id: {gameId})
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
