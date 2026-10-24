import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import GamePermissionGuard from "../src/components/core/GamePermissionGuard";
import { requestGamePermission } from "../src/components/core/logic/GamePermissionUtils";
import type { GameData } from "../src/entities/data/GameData";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData } from "./data/SampleGameState";
import { stubGetUserMedia, stubPermissionQuery, type PermissionQueryResult } from "./helpers/permissions";

const GAME_ID = "camera-game";
const cameraGame: GameData = { ...simpleGameData, modules: { camera: { enabled: true } } };

const restores: (() => void)[] = [];

const permissionQuery = (result: PermissionQueryResult) => {
  const stub = stubPermissionQuery(result);
  restores.push(stub.restore);
  return stub;
};

afterEach(() => {
  restores.forEach((restore) => restore());
  restores.length = 0;
  vi.restoreAllMocks();
});

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={[`/game/${GAME_ID}/play`]}>
      <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { [GAME_ID]: cameraGame } } }}>
        <GameDataProvider id={GAME_ID}>
          <Routes>
            <Route
              path="/game/:id/play"
              element={
                <GamePermissionGuard>
                  <p>Playing the game</p>
                </GamePermissionGuard>
              }
            />
            <Route path="/game/:id" element={<p>Landing page</p>} />
          </Routes>
        </GameDataProvider>
      </GameRepositoryProvider>
    </MemoryRouter>,
  );

describe("GamePermissionGuard", () => {
  it("lets the player in when the camera is granted", async () => {
    permissionQuery("granted");
    renderGuard();

    expect(await screen.findByText("Playing the game")).toBeInTheDocument();
  });

  it("sends the player to the landing page when the browser cannot report the camera permission", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    renderGuard();

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
  });

  it("lets the player in when the browser cannot report the camera, but it was granted in this tab", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    restores.push(stubGetUserMedia().restore);
    await requestGamePermission("camera");
    renderGuard();

    expect(await screen.findByText("Playing the game")).toBeInTheDocument();
  });

  it("sends the player to the landing page when the camera is not granted", async () => {
    permissionQuery("denied");
    renderGuard();

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
  });
});
