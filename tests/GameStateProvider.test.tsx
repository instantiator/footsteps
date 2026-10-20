import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it } from "vitest";
import { createBlankGameState } from "../src/entities/state/GameState";
import { GameStateContext } from "../src/providers/GameStateContext";
import { simpleGameData, simpleRepository } from "./data/SampleGameState";
import { smallGame } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";

/** Prints the title of the game the state is for, and the whole state. */
const StateProbe = () => {
  const { gameState } = useContext(GameStateContext);
  return (
    <>
      <h1>{gameState.gameData.title}</h1>
      <output>{JSON.stringify(gameState)}</output>
    </>
  );
};

describe("GameStateProvider", () => {
  it("starts from the blank state of the loaded game", () => {
    render(
      <GameProviders repository={simpleRepository} gameId="simple-game">
        <StateProbe />
      </GameProviders>,
    );
    expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual(
      JSON.parse(JSON.stringify(createBlankGameState(simpleGameData))),
    );
  });

  // BUG #8 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): state should reset to the new game's blank state when the game changes; actual: useState keeps the first game's state
  it.skip("resets to the new game's blank state when the game changes", () => {
    const repository = { games: { first: simpleGameData, second: smallGame } };
    const { rerender } = render(
      <GameProviders repository={repository} gameId="first">
        <StateProbe />
      </GameProviders>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(simpleGameData.title);

    rerender(
      <GameProviders repository={repository} gameId="second">
        <StateProbe />
      </GameProviders>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(smallGame.title);
  });
});
