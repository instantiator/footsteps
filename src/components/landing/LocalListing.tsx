import { useContext } from "react";
import { Link } from "react-router";
import { GameRepositoryContext } from "../../providers/GameRepositoryContext";

/** The local repository's load status, and once ready a link to play each of its games. */
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
