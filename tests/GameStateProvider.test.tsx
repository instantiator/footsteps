import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import GameStateProvider from "../src/providers/GameStateProvider";
import { useGameState } from "../src/providers/GameStateHook";
import { challenge, game, stage } from "./data/GameBuilders";
import { simpleGameData } from "./data/SampleGameState";

const GAME_ID = "simple-game";

/** Shows the solved challenge count, and offers a way to solve the first challenge. */
function GameStateProbe() {
  const { gameState, setGameState } = useGameState();
  const solved = gameState.stages.flatMap((stage) => stage.challengeStates).filter((challenge) => challenge.succeeded);
  return (
    <div>
      <p>Solved: {solved.length}</p>
      <p>Stage: {gameState.current.stageId ?? "none"}</p>
      <button
        type="button"
        onClick={() => setGameState(completeChallenge(gameState, "stage-1", "stage-1-challenge-1"))}
      >
        Solve stage one
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { [GAME_ID]: simpleGameData } } }}>
      <GameDataProvider id={GAME_ID}>
        <GameStateProvider>
          <GameStateProbe />
        </GameStateProvider>
      </GameDataProvider>
    </GameRepositoryProvider>,
  );

const partlyComplete = (): GameState => {
  const stageOneComplete = completeChallenge(createBlankGameState(simpleGameData), "stage-1", "stage-1-challenge-1");
  return completeChallenge(stageOneComplete, "stage-2", "stage-2-challenge-1");
};

describe("GameStateProvider", () => {
  it("starts blank and does not save the initial state", () => {
    renderProvider();

    expect(screen.getByText("Solved: 0")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("saves progress after a change", async () => {
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Solve stage one" }));

    await waitFor(() => expect(screen.getByText("Solved: 1")).toBeInTheDocument());
    const saved = loadGameState(GAME_ID, simpleGameData);
    expect(saved?.stages[0].completion).toBe("completed");
    expect(saved?.stages[0].challengeStates[0].succeeded).toBe(true);
  });

  it("resumes saved progress", () => {
    saveGameState(GAME_ID, partlyComplete());

    renderProvider();

    expect(screen.getByText("Solved: 2")).toBeInTheDocument();
  });

  it("starts blank when saved progress is invalid", () => {
    localStorage.setItem(`footsteps:game-state:${GAME_ID}`, "{not json");

    renderProvider();

    expect(screen.getByText("Solved: 0")).toBeInTheDocument();
  });
});

describe("GameStateProvider display resets", () => {
  const SCOPE = "challenge:s1:c1:challenge-in-progress";
  const resettingGame = game(["game-overview-stages"], [stage("s1", [challenge("c1")])]);
  resettingGame.stages[0].challenges[0].displays[0].component.resetStateOnShow = true;

  /** Moves in and out of the stage with plain states, as the HUD does, and sets the challenge display's state. */
  function DisplayStateProbe() {
    const { gameState, setGameState } = useGameState();
    const go = (stageId: string | null) => setGameState({ ...gameState, current: { ...gameState.current, stageId } });
    return (
      <div>
        <p>State: {JSON.stringify(gameState.displayStates[SCOPE] ?? null)}</p>
        <button type="button" onClick={() => go("s1")}>
          Enter
        </button>
        <button type="button" onClick={() => go(null)}>
          Leave
        </button>
        <button
          type="button"
          onClick={() => setGameState((s) => ({ ...s, displayStates: { ...s.displayStates, [SCOPE]: { n: 1 } } }))}
        >
          Set
        </button>
      </div>
    );
  }

  it("keeps state while hidden, and resets it when a flagged display is shown again", () => {
    render(
      <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { g: resettingGame } } }}>
        <GameDataProvider id="g">
          <GameStateProvider>
            <DisplayStateProbe />
          </GameStateProvider>
        </GameDataProvider>
      </GameRepositoryProvider>,
    );
    const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

    click("Enter");
    click("Set");
    expect(screen.getByText('State: {"n":1}')).toBeInTheDocument();
    click("Leave");
    expect(screen.getByText('State: {"n":1}')).toBeInTheDocument();
    click("Enter");
    expect(screen.getByText("State: null")).toBeInTheDocument();
  });
});
