import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import GameStateProvider from "../src/providers/GameStateProvider";
import { useGameState } from "../src/providers/GameStateHook";
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
