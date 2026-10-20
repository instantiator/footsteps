import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import HeadsUpDisplay from "../src/components/core/HeadsUpDisplay";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
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

describe("HeadsUpDisplay", () => {
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
});
