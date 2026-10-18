import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameRepository } from "../src/entities/GameRepository";
import type { GameSource } from "../src/entities/GameSource";
import { GameRepositoryContext, type GameRepositoryContextType } from "../src/providers/GameRepositoryContext";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { getBaseURL } from "../src/util/ObjectUtils";

const source: GameSource = { type: "LocalRepository", path: "game-repository.json" };

describe("public/game-repository.json", () => {
  it("loads", async () => {
    const localRepository: GameRepository = await fetch(new URL(source.path, getBaseURL())).then((res) => res.json());
    expect(localRepository).toBeDefined();
  });
});

describe("GameRepositoryProvider", () => {
  it("loads the local repository", async () => {
    const localRepository: GameRepository = await fetch(new URL(source.path, getBaseURL())).then((res) => res.json());
    let contextValue: GameRepositoryContextType | undefined;

    render(
      <GameRepositoryProvider source={source}>
        <GameRepositoryContext.Consumer>
          {(context) => {
            contextValue = context;
            return null;
          }}
        </GameRepositoryContext.Consumer>
      </GameRepositoryProvider>,
    );

    expect(contextValue).toBeDefined();
    expect(contextValue!.source).toEqual(source);

    await waitFor(() => {
      expect(contextValue!.repository).toBeDefined();
    });
    await waitFor(() => {
      expect(contextValue!.repository.ready).toBe(true);
    });

    expect(contextValue!.repository).toEqual({
      ...localRepository,
      ready: true,
      loading: false,
    });
    expect(contextValue!.repository.games["magic-trifle"]).toBeDefined();
  });
});
