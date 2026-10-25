import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setTrackingFps } from "../src/components/camera/TrackingFpsStore";
import HeadsUpDisplay from "../src/components/core/HeadsUpDisplay";
import { ENV_APP_CONFIG } from "../src/config/AppConfig";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { AppConfigContext } from "../src/providers/AppConfigContext";
import { GameStateContext } from "../src/providers/GameStateContext";
import { simpleGameData } from "./data/SampleGameState";
import { smallGame } from "./data/SmallGame";

/** Holds the state the HUD changes, and prints the part of it the HUD controls. */
const Harness = ({ initial }: { initial: GameState }) => {
  const [gameState, setGameState] = useState(initial);
  return (
    <GameStateContext.Provider value={{ gameState, setGameState }}>
      <HeadsUpDisplay />
      <output>{JSON.stringify(gameState.current)}</output>
    </GameStateContext.Provider>
  );
};

/** The title screen, a stage open, or the stages overview, in a game that has a title display. */
const titleState = createBlankGameState(simpleGameData);
const stageState: GameState = {
  ...titleState,
  current: { stageId: "stage-1", overviewDisplay: "game-overview-stages" },
};
const overviewState: GameState = {
  ...titleState,
  current: { stageId: null, overviewDisplay: "game-overview-stages" },
};

const current = () => JSON.parse(screen.getByRole("status").textContent!);

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
    expect(current()).toEqual({ stageId: null, overviewDisplay: "game-overview-stages" });
  });

  it("returns to the title screen, closing any open stage", () => {
    render(<Harness initial={stageState} />);
    fireEvent.click(screen.getByRole("button", { name: "To title" }));
    expect(current()).toEqual({ stageId: null, overviewDisplay: "game-overview-title" });
  });

  it("offers only the way back to the title from the stages overview", () => {
    render(<Harness initial={overviewState} />);
    expect(screen.getByRole("button", { name: "To title" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close challenge" })).toBeNull();
  });

  it("does not offer 'To title' in a game with no title display", () => {
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

describe("HeadsUpDisplay frame rate", () => {
  afterEach(() => act(() => setTrackingFps(null)));

  /** The HUD over the title screen, with `showFps` as given. */
  const renderHud = (showFps: boolean) =>
    render(
      <AppConfigContext.Provider value={{ ...ENV_APP_CONFIG, showFps }}>
        <Harness initial={titleState} />
      </AppConfigContext.Provider>,
    );

  const indicator = () => screen.queryByLabelText("Camera tracking frame rate");

  it("shows the tracking frame rate, in whole frames, while a camera is tracked", () => {
    renderHud(true);
    expect(indicator()).toBeNull(); // no camera yet

    act(() => setTrackingFps(12.4));
    expect(indicator()).toHaveTextContent("12 fps");

    act(() => setTrackingFps(null));
    expect(indicator()).toBeNull();
  });

  it("hides the frame rate when the setting is off", () => {
    renderHud(false);
    act(() => setTrackingFps(12));
    expect(indicator()).toBeNull();
  });
});
