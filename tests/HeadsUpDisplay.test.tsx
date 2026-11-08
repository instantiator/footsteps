import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import HeadsUpDisplay from "../src/components/core/HeadsUpDisplay";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { GameDataContext } from "../src/providers/GameDataContext";
import { GameStateContext } from "../src/providers/GameStateContext";
import { simpleGameData } from "./data/SampleGameState";
import { smallGame } from "./data/SmallGame";

/** The router and loaded game the HUD runs in; the route shows where Go to navigated. */
const InGame = ({ gameState, children }: { gameState: GameState; children: ReactNode }) => (
  <MemoryRouter initialEntries={["/game/hud-game/play"]}>
    <GameDataContext.Provider
      value={{ gameData: gameState.gameData, gameId: "hud-game", resources: {}, expressions: new Map() }}
    >
      {children}
      <Routes>
        <Route path="*" element={<RoutePath />} />
      </Routes>
    </GameDataContext.Provider>
  </MemoryRouter>
);

/** Prints the current route. */
const RoutePath = () => <p data-testid="route">{useLocation().pathname}</p>;

/** Holds the state the HUD changes, and prints the part of it the HUD controls. */
const Harness = ({ initial }: { initial: GameState }) => {
  const [gameState, setGameState] = useState(initial);
  return (
    <InGame gameState={gameState}>
      <GameStateContext.Provider value={{ gameState, setGameState }}>
        <HeadsUpDisplay debug={false} />
        <output data-testid="current">{JSON.stringify(gameState.current)}</output>
        <output data-testid="stages">
          {JSON.stringify(gameState.stages.map((stage) => stage.challengeStates.map((c) => c.succeeded)))}
        </output>
        <output data-testid="focus">{JSON.stringify(gameState.session.focusedChallenge)}</output>
      </GameStateContext.Provider>
    </InGame>
  );
};

/** The title screen, a stage open, or the stages overview, in a game that has a title scene. */
const titleState = createBlankGameState(simpleGameData);
const stageState: GameState = {
  ...titleState,
  current: { stageId: "stage-1", overviewScene: "game-overview-stages" },
};
const overviewState: GameState = {
  ...titleState,
  current: { stageId: null, overviewScene: "game-overview-stages" },
};

const current = () => JSON.parse(screen.getByTestId("current").textContent!);

/** What the document reports as its fullscreen element, as the browser would. */
let fullscreenElement: Element | null = null;

/** Makes the document report the given fullscreen element, firing the change event as the browser does. */
const setFullscreenElement = (element: Element | null) => {
  fullscreenElement = element;
  document.dispatchEvent(new Event("fullscreenchange"));
};

/** Mocks the fullscreen API, so a button press reports success and fires the change event. */
const mockFullscreen = () => {
  fullscreenElement = null;
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  const requestFullscreen = vi.fn(() => {
    setFullscreenElement(document.documentElement);
    return Promise.resolve();
  });
  const exitFullscreen = vi.fn(() => {
    setFullscreenElement(null);
    return Promise.resolve();
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  return { requestFullscreen, exitFullscreen };
};

describe("HeadsUpDisplay", () => {
  afterEach(() => {
    fullscreenElement = null;
    for (const key of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) {
      Reflect.deleteProperty(document, key);
    }
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    vi.restoreAllMocks();
  });

  it("offers nothing on the title screen with no stage open", () => {
    render(<Harness initial={titleState} />);
    expect(screen.queryByRole("button", { name: "Close challenge" })).toBeNull();
    expect(screen.queryByRole("button", { name: "To title" })).toBeNull();
  });

  it("closes the open stage, leaving the overview showing", () => {
    render(<Harness initial={stageState} />);
    fireEvent.click(screen.getByRole("button", { name: "Close challenge" }));
    expect(current()).toEqual({ stageId: null, overviewScene: "game-overview-stages" });
  });

  it("returns to the title screen, closing any open stage", () => {
    render(<Harness initial={stageState} />);
    fireEvent.click(screen.getByRole("button", { name: "To title" }));
    expect(current()).toEqual({ stageId: null, overviewScene: "game-overview-title" });
  });

  it("offers only the way back to the title from the stages overview", () => {
    render(<Harness initial={overviewState} />);
    expect(screen.getByRole("button", { name: "To title" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close challenge" })).toBeNull();
  });

  it("does not offer 'To title' in a game with no title scene", () => {
    render(<Harness initial={createBlankGameState(smallGame)} />);
    expect(screen.queryByRole("button", { name: "To title" })).toBeNull();
  });

  it("offers the fullscreen toggle on the title screen, where no other button applies", () => {
    render(<Harness initial={titleState} />);
    expect(screen.getByRole("button", { name: "Full screen" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the whole document in and out of fullscreen, following the label", () => {
    const { requestFullscreen, exitFullscreen } = mockFullscreen();
    render(<Harness initial={titleState} />);

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    const exit = screen.getByRole("button", { name: "Exit full screen" });
    expect(exit).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(exit);
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Full screen" })).toHaveAttribute("aria-pressed", "false");
  });

  it("follows a fullscreen change the browser makes itself", () => {
    mockFullscreen();
    render(<Harness initial={titleState} />);

    act(() => setFullscreenElement(document.documentElement));
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
  });

  it("warns instead of failing when the browser has no fullscreen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Harness initial={titleState} />);

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("HeadsUpDisplay Go to and Reset", () => {
  /** Picks an entry by its label, and presses the list's button. */
  const pick = (list: string, label: string, button: string) => {
    const select = screen.getByRole("combobox", { name: list });
    const option = within(select).getByRole<HTMLOptionElement>("option", { name: label });
    fireEvent.change(select, { target: { value: option.value } });
    fireEvent.click(screen.getByRole("button", { name: button }));
  };

  it("goes to the catalogue and the game's landing page", () => {
    render(<Harness initial={titleState} />);
    pick("Go to", "Catalogue (all games)", "Go");
    expect(screen.getByTestId("route")).toHaveTextContent(/^\/$/);
    pick("Go to", "Game: Simple Game", "Go");
    expect(screen.getByTestId("route")).toHaveTextContent("/game/hud-game");
  });

  it("goes to a stage, a challenge, and back to the title", () => {
    render(<Harness initial={overviewState} />);
    pick("Go to", "Stage: 1", "Go");
    expect(current().stageId).toBe("stage-1");
    pick("Go to", "Challenge: 1.1", "Go");
    expect(JSON.parse(screen.getByTestId("focus").textContent!)).toEqual({
      stageId: "stage-1",
      challengeId: simpleGameData.stages[0].challenges[0].id,
    });
    pick("Go to", "Title: Simple Game", "Go");
    expect(current()).toEqual({ stageId: null, overviewScene: "game-overview-title" });
    expect(screen.getByTestId("focus")).toHaveTextContent("null");
  });

  it("won't pick a locked stage", () => {
    render(<Harness initial={titleState} />);
    expect(screen.getByRole("option", { name: "🔒 Stage: 2" })).toBeDisabled();
  });

  it("offers nothing to reset until a challenge is solved, then resets it", () => {
    const stageId = simpleGameData.stages[0].id;
    const challengeId = simpleGameData.stages[0].challenges[0].id;
    const { unmount } = render(<Harness initial={titleState} />);
    expect(screen.getByRole("combobox", { name: "Reset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    unmount();

    render(<Harness initial={completeChallenge(titleState, stageId, challengeId)} />);
    pick("Reset", "✓ Challenge: 1.1", "Reset");
    expect(JSON.parse(screen.getByTestId("stages").textContent!)[0][0]).toBe(false);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});

describe("HeadsUpDisplay debug button", () => {
  /** The HUD over the title screen, with the debug aids as given. */
  const renderHud = (debug: boolean, onToggleDebug?: () => void) =>
    render(
      <InGame gameState={titleState}>
        <GameStateContext.Provider value={{ gameState: titleState, setGameState: () => {} }}>
          <HeadsUpDisplay debug={debug} onToggleDebug={onToggleDebug} />
        </GameStateContext.Provider>
      </InGame>,
    );

  it("offers to switch the debug aids on while they are off, and off while they are on", () => {
    const { unmount } = renderHud(false, () => {});
    expect(screen.getByRole("button", { name: "Debug on" })).toHaveAttribute("aria-pressed", "false");
    unmount();
    renderHud(true, () => {});
    expect(screen.getByRole("button", { name: "Debug off" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches them when pressed", () => {
    const onToggleDebug = vi.fn();
    renderHud(false, onToggleDebug);
    fireEvent.click(screen.getByRole("button", { name: "Debug on" }));
    expect(onToggleDebug).toHaveBeenCalledOnce();
  });

  it("shows no frame rate, which the vision stats readout shows instead", () => {
    renderHud(true, () => {});
    expect(screen.queryByText(/fps/)).toBeNull();
  });
});
