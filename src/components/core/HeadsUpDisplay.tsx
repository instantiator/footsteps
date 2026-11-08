import { useState } from "react";
import { useNavigate } from "react-router";
import { useGameData } from "../../providers/GameDataHook";
import { useGameState } from "../../providers/GameStateHook";
import useFullscreen from "./FullscreenHook";
import { withoutFocus } from "./logic/GameStateUtils";
import {
  goTo,
  goToOptions,
  resetOptions,
  resetTo,
  type ChallengeRef,
  type GoToTarget,
  type HudOption,
} from "./logic/HudNavigation";
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
    setGameState(withoutFocus({ ...gameState, current: { ...gameState.current, ...current } }));
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

/** Props for {@link HudPicker}. */
interface HudPickerProps<T> {
  /** Names the list, for screen readers and tests. */
  label: string;
  /** What the list offers. */
  options: HudOption<T>[];
  /** The button's text. */
  action: string;
  /** Called with the picked entry's target. */
  onPick: (target: T) => void;
}

/** A list and a button that acts on the picked entry; both are disabled while nothing can be picked. */
function HudPicker<T>({ label, options, action, onPick }: HudPickerProps<T>) {
  const [chosen, setChosen] = useState(0);
  // Keep a pick that is still allowed, else take the first that is, as entries complete and unlock
  const index = options[chosen]?.disabled === false ? chosen : options.findIndex((option) => !option.disabled);
  const none = index < 0;
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      <select
        aria-label={label}
        style={buttonStyle}
        value={none ? "" : index}
        disabled={none}
        onChange={(event) => setChosen(Number(event.target.value))}
      >
        {none && <option value="">Nothing to {action.toLowerCase()}</option>}
        {options.map((option, i) => (
          <option key={i} value={i} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <button style={buttonStyle} disabled={none} onClick={() => onPick(options[index].target)}>
        {action}
      </button>
    </span>
  );
}

/** The menu's panel, hung below the HUD's row so it covers nothing until opened. */
const menuStyle = {
  ...panelStyle,
  position: "absolute",
  top: "100%",
  right: 0,
  flexDirection: "column",
  alignItems: "stretch",
  borderRadius: "0 0 0 10px",
} as const;

/** Props for {@link HudMenu}. */
interface HudMenuProps extends HeadsUpDisplayProps {
  /** Closes the menu, after any of its actions. */
  onDone: () => void;
}

/**
 * The menu's contents: Go to anywhere in the game (or out to the catalogue or its landing page), Reset a solved
 * challenge, and switch the debug aids.
 */
function HudMenu({ debug, onToggleDebug, onDone }: HudMenuProps) {
  const { gameState, setGameState } = useGameState();
  const { gameId } = useGameData();
  const navigate = useNavigate();
  const go = (target: GoToTarget) => {
    if (target.kind === "catalogue") navigate("/");
    else if (target.kind === "game") navigate(`/game/${gameId}`);
    else setGameState((state) => goTo(state, target) ?? state);
    onDone();
  };
  const reset = (target: ChallengeRef) => {
    setGameState((state) => resetTo(state, target));
    onDone();
  };
  return (
    <div id="hud-menu" style={menuStyle}>
      <HudPicker label="Go to" options={goToOptions(gameState)} action="Go" onPick={go} />
      <HudPicker label="Reset" options={resetOptions(gameState)} action="Reset" onPick={reset} />
      {onToggleDebug && (
        <button
          style={buttonStyle}
          onClick={() => {
            onToggleDebug();
            onDone();
          }}
          aria-pressed={debug}
        >
          {debug ? "Debug off" : "Debug on"}
        </button>
      )}
    </div>
  );
}

/**
 * The HUD: a Menu (Go to, Reset and the debug aids), buttons to leave the current challenge or return to the title
 * screen when either applies, and the fullscreen toggle.
 */
export default function HeadsUpDisplay(props: HeadsUpDisplayProps) {
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ ...panelStyle, position: "relative" }}>
      <button
        style={buttonStyle}
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="hud-menu"
      >
        Menu
      </button>
      {menuOpen && <HudMenu {...props} onDone={() => setMenuOpen(false)} />}
      <LeaveButtons />
      <button style={buttonStyle} onClick={toggleFullscreen} aria-pressed={isFullscreen}>
        {isFullscreen ? "Exit full screen" : "Full screen"}
      </button>
    </div>
  );
}
