import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameData } from "../src/entities/data/GameData";
import LocalGame from "../src/pages/LocalGame";
import { simpleGameData } from "./data/SampleGameState";
import { stubMediaPlayback } from "./helpers/media";
import { stubPermissionQuery } from "./helpers/permissions";
import { server } from "./mocks/server";

const restores: (() => void)[] = [];

const permissionQuery = (result: "granted" | "prompt" | "denied" | "error") => {
  const stub = stubPermissionQuery(result);
  restores.push(stub.restore);
  return stub;
};

beforeEach(() => {
  stubMediaPlayback();
});
afterEach(() => {
  restores.forEach((restore) => restore());
  restores.length = 0;
  vi.restoreAllMocks();
  server.events.removeAllListeners();
  server.resetHandlers();
});

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: "/game/:id/play", element: <LocalGame /> },
      { path: "/game/:id", element: <p>Landing page</p> },
    ],
    {
      initialEntries: [path],
    },
  );
  return render(<RouterProvider router={router} />);
};

/** Resolves once the local repository has been served, so absence of a game means it was looked for and not found. */
const repositoryServed = () =>
  new Promise<void>((resolve) => {
    server.events.on("response:mocked", ({ request }) => {
      if (request.url.endsWith("game-repository.json")) resolve();
    });
  });

const cameraGame: GameData = { ...simpleGameData, modules: { camera: { enabled: true } } };

describe("LocalGame", () => {
  it("plays the game with the routed id once the local repository loads", async () => {
    permissionQuery("granted"); // magic-trifle uses the camera
    const { container } = renderAt("/game/magic-trifle/play");
    // jsdom never loads stylesheets, and React holds the game back until they have
    await waitFor(() => {
      document.head.querySelectorAll("link").forEach((link) => link.dispatchEvent(new Event("load")));
      expect(container.querySelector("#game-container")).not.toBeNull();
    });
    await waitFor(() =>
      expect(container.querySelector("#overview-foreground-container #magic-trifle-title")).not.toBeNull(),
    );
  });

  it("renders no game for an unknown id", async () => {
    const served = repositoryServed();
    const { container } = renderAt("/game/unknown/play");
    await served;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector("#game-container")).toBeNull();
  });

  it("sends the player to the landing page when a required camera permission is missing", async () => {
    server.use(http.get("*/game-repository.json", () => HttpResponse.json({ games: { "camera-game": cameraGame } })));
    permissionQuery("prompt");

    renderAt("/game/camera-game/play");

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
  });
});
