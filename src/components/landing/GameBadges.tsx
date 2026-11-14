import type { GameData } from "../../entities/data/GameData";
import type { GameState } from "../../entities/state/GameState";
import { gameBadges } from "../core/logic/GameBadgeUtils";

/** A game's badges, as a list. */
export default function GameBadges({ gameData, saved }: { gameData: GameData; saved?: GameState }) {
  return (
    <ul className="game-badges" aria-label="About this game">
      {gameBadges(gameData, saved).map((badge) => (
        <li key={badge}>{badge}</li>
      ))}
    </ul>
  );
}
