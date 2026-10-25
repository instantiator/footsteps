import useAppConfig from "../../providers/AppConfigHook";
import { useGameState } from "../../providers/GameStateHook";
import { useTrackingFps } from "../camera/TrackingFpsStore";
import useFullscreen from "./FullscreenHook";
import { getRenderMode } from "./logic/RenderDataUtils";

/**
 * The HUD buttons' shared look: small and snug, so they take little of the game's space, and in the app's font
 * rather than the game's.
 */
const buttonStyle = { margin: 0, padding: 5, fontSize: "0.75em", fontFamily: "var(--app-font)", lineHeight: "normal" };

/** The camera tracking's frame rate, when the `showFps` setting is on and a camera is being tracked. */
const FpsIndicator = () => {
  const { showFps } = useAppConfig();
  const fps = useTrackingFps();
  if (!showFps || fps === null) return null;
  // A transparent border as wide as a button's, so the indicator is as tall as the buttons beside it
  return (
    <output
      style={{
        ...buttonStyle,
        border: "2px solid transparent",
        color: "#fff",
        background: "#000a",
        borderRadius: 4,
        fontVariantNumeric: "tabular-nums",
      }}
      aria-label="Camera tracking frame rate"
    >
      {fps} fps
    </output>
  );
};

/**
 * Buttons to toggle fullscreen, leave the current challenge, or return to the title screen, when either applies;
 * and the camera tracking's frame rate (`FpsIndicator`).
 */
export default function HeadsUpDisplay() {
  const { gameState, setGameState } = useGameState();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  /** Offered while a stage is open. */
  const showCloseChallengeButton = getRenderMode(gameState) === "stage";
  /** Offered when the game has a title screen and it is not showing. */
  const showTitleReturnButton =
    gameState.current.overviewDisplay !== "game-overview-title" &&
    gameState.gameData.displays.some((d) => d.purpose === "game-overview-title");

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

  return (
    <>
      <div
        style={{
          background: "#ffffff22",
          backdropFilter: "blur(4px)",
          padding: "10px",
          borderBottomLeftRadius: "10px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {showCloseChallengeButton && (
          <button style={buttonStyle} onClick={closeChallenge}>
            Close challenge
          </button>
        )}
        {showTitleReturnButton && (
          <button style={buttonStyle} onClick={returnToTitle}>
            To title
          </button>
        )}
        <FpsIndicator />
        <button style={buttonStyle} onClick={toggleFullscreen} aria-pressed={isFullscreen}>
          {isFullscreen ? "Exit full screen" : "Full screen"}
        </button>
      </div>
    </>
  );
}
