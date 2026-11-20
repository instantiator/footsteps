import { useMemo, type CSSProperties } from "react";
import { useGameData } from "../../providers/GameDataHook";
import { isDefined } from "../../util/ObjectUtils";

/** The style of a game's own pages: its tile graphic behind them, and its font. */
export const useGamePageStyle = (): CSSProperties => {
  const { gameData, resources } = useGameData();
  const graphic = useMemo(
    () => (isDefined(gameData.tileGraphic) ? resources[gameData.tileGraphic] : undefined),
    [gameData.tileGraphic, resources],
  );
  return {
    backgroundImage: isDefined(graphic) ? `url("${graphic}")` : undefined,
    fontFamily: gameData.gameContainerStyle.fontFamily,
  };
};
