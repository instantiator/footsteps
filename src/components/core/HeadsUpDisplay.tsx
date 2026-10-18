import { useEffect, useState } from "react";
import { useGameState } from "../../providers/GameStateHook";
import { getRenderMode } from "./logic/RenderDataUtils";

export default function HeadsUpDisplay() {
  const { gameState, setGameState } = useGameState();

  const [showCloseChallengeButton, setShowCloseChallengeButton] = useState<boolean>(false);
  const [showTitleReturnButton, setShowTitleReturnButton] = useState<boolean>(false);

  useEffect(() => {
    const gameMode = getRenderMode(gameState);
    setShowCloseChallengeButton(gameMode === "stage");
    setShowTitleReturnButton(gameState.current.overviewDisplay !== "game-overview-title");
  }, [gameState]);

  const returnToTitle = () => {
    setGameState({
      ...gameState,
      current: {
        ...gameState.current,
        overviewDisplay: "game-overview-title",
        stageId: null,
      },
    });
  };

  const closeChallenge = () => {
    setGameState({
      ...gameState,
      current: {
        ...gameState.current,
        stageId: null,
      },
    });
  };

  const showAny = showCloseChallengeButton || showTitleReturnButton;

  return (
    <>
      <div
        style={{
          background: "#ffffff22",
          backdropFilter: "blur(4px)",
          padding: "10px",
          borderBottomLeftRadius: "10px",
          display: showAny ? "flex" : "none",
          flexDirection: "row",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {showCloseChallengeButton && (
          <button style={{ margin: 0, padding: 5, fontSize: "0.75em" }} onClick={closeChallenge}>
            Close challenge
          </button>
        )}
        {showTitleReturnButton && (
          <button style={{ margin: 0, padding: 5, fontSize: "0.75em" }} onClick={returnToTitle}>
            To title
          </button>
        )}
      </div>
    </>
  );
}
