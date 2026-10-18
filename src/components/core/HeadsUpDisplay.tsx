import { useGameState } from "../../providers/GameStateHook";
import { getRenderMode } from "./logic/RenderDataUtils";

/** Buttons to leave the current challenge, or return to the title screen, when either applies. */
export default function HeadsUpDisplay() {
  const { gameState, setGameState } = useGameState();

  const showCloseChallengeButton = getRenderMode(gameState) === "stage";
  const showTitleReturnButton = gameState.current.overviewDisplay !== "game-overview-title";

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
