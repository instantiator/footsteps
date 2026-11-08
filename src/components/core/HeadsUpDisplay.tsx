import { useGameState } from "../../providers/GameStateHook";
import useFullscreen from "./FullscreenHook";
import { getRenderMode } from "./logic/RenderDataUtils";

/**
 * The HUD buttons' shared look: small and snug, so they take little of the game's space, and in the app's font
 * rather than the game's.
 */
const buttonStyle = { margin: 0, padding: 5, fontSize: "0.75em", fontFamily: "var(--app-font)", lineHeight: "normal" };

/** Props for {@link HeadsUpDisplay}. */
interface HeadsUpDisplayProps {
  /** Whether the debug aids are showing. */
  debug: boolean;
  /** Switches the debug aids on or off; no button without it. */
  onToggleDebug?: () => void;
}

/** The HUD's panel: a frosted strip along the top right, its controls in a row that wraps on narrow screens. */
const panelStyle = {
  background: "#ffffff22",
  backdropFilter: "blur(4px)",
  padding: "10px",
  borderBottomLeftRadius: "10px",
  display: "flex",
  flexFlow: "row wrap",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "5px",
} as const;

/** "Close challenge" while a stage is open, and "To title" when the game has a title screen that isn't showing. */
function LeaveButtons() {
  const { gameState, setGameState } = useGameState();
  const showCloseChallengeButton = getRenderMode(gameState) === "stage";
  const showTitleReturnButton =
    gameState.current.overviewScene !== "game-overview-title" &&
    gameState.gameData.scenes.some((d) => d.purpose === "game-overview-title");
  const show = (current: Partial<typeof gameState.current>) =>
    setGameState({ ...gameState, current: { ...gameState.current, ...current } });
  return (
    <>
      {showCloseChallengeButton && (
        <button style={buttonStyle} onClick={() => show({ stageId: null })}>
          Close challenge
        </button>
      )}
      {showTitleReturnButton && (
        <button style={buttonStyle} onClick={() => show({ overviewScene: "game-overview-title", stageId: null })}>
          To title
        </button>
      )}
    </>
  );
}

/**
 * Buttons to toggle fullscreen and the debug aids, and to leave the current challenge or return to the title screen,
 * when either applies.
 */
export default function HeadsUpDisplay({ debug, onToggleDebug }: HeadsUpDisplayProps) {
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  return (
    <div style={panelStyle}>
      <LeaveButtons />
      {onToggleDebug && (
        <button style={buttonStyle} onClick={onToggleDebug} aria-pressed={debug}>
          {debug ? "Debug off" : "Debug on"}
        </button>
      )}
      <button style={buttonStyle} onClick={toggleFullscreen} aria-pressed={isFullscreen}>
        {isFullscreen ? "Exit full screen" : "Full screen"}
      </button>
    </div>
  );
}
