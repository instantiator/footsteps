import { useContext } from "react";
import { Link } from "react-router";
import type { GameData, GameId } from "../../entities/data/GameData";
import type { GameSource } from "../../entities/GameSource";
import { GameRepositoryContext } from "../../providers/GameRepositoryContext";
import { isDefined } from "../../util/ObjectUtils";
import { resolveResources } from "../../util/ResourceUtils";
import "./GamePanel.css";
import "./GameTile.css";

/** Props for {@link GameTile}. */
interface GameTileProps {
  /** The game's id, also its URL. */
  gameId: GameId;
  /** The game to show. */
  gameData: GameData;
}

/**
 * The absolute URL of a game's tile graphic, or undefined when it names none or it can't be resolved.
 *
 * NB. A raw repository has no location, so its `relative` resources can't be resolved; the tile then
 * falls back to a plain background rather than failing the whole listing.
 */
function tileGraphicURL(gameData: GameData, source: GameSource): string | undefined {
  if (!isDefined(gameData.tileGraphic)) return undefined;
  try {
    return resolveResources(gameData.resources, source)[gameData.tileGraphic];
  } catch (error) {
    console.warn(`Could not resolve tile graphic "${gameData.tileGraphic}":`, error);
    return undefined;
  }
}

/** A square, clickable tile: a game's title, id and description over its graphic. */
export default function GameTile({ gameId, gameData }: GameTileProps) {
  const { source } = useContext(GameRepositoryContext);
  const graphic = tileGraphicURL(gameData, source);

  return (
    <Link
      to={`/game/${gameId}`}
      className="game-tile"
      aria-label={`Play ${gameData.title}`}
      style={isDefined(graphic) ? { backgroundImage: `url("${graphic}")` } : undefined}
    >
      <div className="game-tile-panel game-panel">
        <h3>{gameData.title}</h3>
        <p className="game-tile-id">{gameId}</p>
        <p>{gameData.description}</p>
      </div>
    </Link>
  );
}
