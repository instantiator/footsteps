import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalGame from "../src/pages/LocalGame";
import { stubMediaPlayback } from "./helpers/media";
import { server } from "./mocks/server";

beforeEach(() => {
  stubMediaPlayback();
});
afterEach(() => {
  vi.restoreAllMocks();
  server.events.removeAllListeners();
});

const renderAt = (path: string) => {
  const router = createMemoryRouter([{ path: "/game/:id/play", element: <LocalGame /> }], {
    initialEntries: [path],
  });
  return render(<RouterProvider router={router} />);
};

/** Resolves once the local repository has been served, so absence of a game means it was looked for and not found. */
const repositoryServed = () =>
  new Promise<void>((resolve) => {
    server.events.on("response:mocked", ({ request }) => {
      if (request.url.endsWith("game-repository.json")) resolve();
    });
  });

describe("LocalGame", () => {
  it("plays the game with the routed id once the local repository loads", async () => {
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
});
