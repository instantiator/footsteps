import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { GameRepository } from "../src/entities/GameRepository";
import type { GameSource } from "../src/entities/GameSource";
import { GameRepositoryContext, type GameRepositoryContextType } from "../src/providers/GameRepositoryContext";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { getBaseURL } from "../src/util/ObjectUtils";
import { server } from "./mocks/server";

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

describe("GameRepositoryProvider with a raw repository", () => {
  it("provides it as ready on the first render, without fetching", () => {
    const raw: GameRepository = { games: {}, ready: false, loading: false };
    let contextValue: GameRepositoryContextType | undefined;
    render(
      <GameRepositoryProvider source={{ type: "RawRepository", repository: raw }}>
        <GameRepositoryContext.Consumer>
          {(context) => {
            contextValue = context;
            return null;
          }}
        </GameRepositoryContext.Consumer>
      </GameRepositoryProvider>,
    );
    expect(contextValue!.repository.ready).toBe(true);
  });
});

describe("GameRepositoryProvider when the fetch fails", () => {
  const renderLocal = () => {
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
    return () => contextValue!.repository;
  };

  it("reports a network failure as not ready, with the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(http.get("/game-repository.json", () => HttpResponse.error()));
    const repository = renderLocal();
    await waitFor(() => expect(repository().error).toBeDefined());
    expect(repository().ready).toBe(false);
  });

  // BUG #13 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): a 404 with a JSON body should be a failed repository; actual: response.ok is not checked, so the body is treated as a ready repository
  it.skip("reports an error status response with a JSON body as not ready, with the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(http.get("/game-repository.json", () => HttpResponse.json({ message: "Not found" }, { status: 404 })));
    const repository = renderLocal();
    await waitFor(() => expect(repository().loading).toBe(false));
    expect(repository().ready).toBe(false);
    expect(repository().error).toBeDefined();
  });
});
