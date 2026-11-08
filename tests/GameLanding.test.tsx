import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCalibration } from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import GameLanding from "../src/components/landing/GameLanding";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData } from "./data/SampleGameState";
import { stubGetUserMedia, stubPermissionQuery, type PermissionQueryResult } from "./helpers/permissions";

const GAME_ID = "simple-game";

const cameraGame: GameData = { ...simpleGameData, modules: { avatar: { mode: "camera" } } };
const optionalCameraGame: GameData = { ...simpleGameData, modules: { avatar: { mode: "camera", fallback: "mouse" } } };
const floorGame: GameData = { ...optionalCameraGame, modules: { ...optionalCameraGame.modules, scene: "2.5D" } };

/** A state with stage 1 complete and stage 2 partly complete. */
const partlyComplete = (): GameState => {
  const stageOneComplete = completeChallenge(createBlankGameState(simpleGameData), "stage-1", "stage-1-challenge-1");
  return completeChallenge(stageOneComplete, "stage-2", "stage-2-challenge-1");
};

const restores: (() => void)[] = [];

const permissionQuery = (result: PermissionQueryResult) => {
  const stub = stubPermissionQuery(result);
  restores.push(stub.restore);
  return stub;
};

const getUserMedia = (error?: Error) => {
  const stub = stubGetUserMedia(error);
  restores.push(stub.restore);
  return stub;
};

afterEach(() => {
  localStorage.clear();
  restores.forEach((restore) => restore());
  restores.length = 0;
  vi.restoreAllMocks();
});

/** Renders the landing page with a play route that stands in for the game. */
const renderLanding = (game: GameData = simpleGameData) =>
  render(
    <MemoryRouter initialEntries={[`/game/${GAME_ID}`]}>
      <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { [GAME_ID]: game } } }}>
        <GameDataProvider id={GAME_ID}>
          <Routes>
            <Route path="/game/:id" element={<GameLanding />} />
            <Route path="/game/:id/play" element={<p>Playing the game</p>} />
            <Route path="/game/:id/calibrate" element={<p>Calibrating</p>} />
          </Routes>
        </GameDataProvider>
      </GameRepositoryProvider>
    </MemoryRouter>,
  );

describe("GameLanding for a game with 2.5D scenes", () => {
  it("holds New game back until the camera's floor is calibrated, and links to calibrate it", async () => {
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);

    expect(await screen.findByText("Calibrate the floor before you start.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
    expect(await screen.findByText(/This camera has no saved floor area yet/)).toBeInTheDocument();
    expect(document.querySelector(".game-camera-preview polygon")).not.toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Calibrate the floor" }));
    expect(screen.getByText("Calibrating")).toBeInTheDocument();
  });

  it("lets the player start once the camera has a saved floor", async () => {
    saveCalibration("default", DEFAULT_CORNERS);
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);

    expect(await screen.findByText(/This camera has a saved floor area/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });

  it("lets a player without the camera start, to play by mouse", async () => {
    permissionQuery("prompt");
    renderLanding(floorGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
    expect(screen.queryByText("Calibrate the floor before you start.")).toBeNull();
  });
});

describe("GameLanding", () => {
  it("shows the game's title and description", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: "Simple Game" })).toBeInTheDocument();
    expect(screen.getByText("A simple game for tests.")).toBeInTheDocument();
  });

  it("uses the game's tile graphic as the background", () => {
    const game: GameData = {
      ...simpleGameData,
      resources: { poster: { type: "local", target: "games/magic-trifle/tape-still.png" } },
      tileGraphic: "poster",
    };
    const { container } = renderLanding(game);

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.backgroundImage).toContain(
      "games/magic-trifle/tape-still.png",
    );
  });

  it("falls back to a plain background when the game names no graphic", () => {
    const { container } = renderLanding();

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.backgroundImage).toBe("");
  });

  it("uses the game's font", () => {
    const game: GameData = { ...simpleGameData, gameContainerStyle: { fontFamily: '"DynaPuff", serif' } };
    const { container } = renderLanding(game);

    expect(container.querySelector<HTMLElement>(".game-landing")?.style.fontFamily).toContain("DynaPuff");
  });

  it("starts the game from the New game button", () => {
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(screen.getByText("Playing the game")).toBeInTheDocument();
  });

  it("shows no permissions panel when the game doesn't use the camera", () => {
    renderLanding();

    expect(screen.queryByRole("heading", { name: "Permissions" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });

  it("offers the camera, but lets the player start without it, when it is only enabled", async () => {
    permissionQuery("prompt");
    renderLanding(optionalCameraGame);

    expect(await screen.findByRole("button", { name: "Grant camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });

  it("lists a required camera and enables New game after it is granted", async () => {
    permissionQuery("prompt");
    getUserMedia();
    renderLanding(cameraGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    const newGame = screen.getByRole("button", { name: "New game" });
    expect(newGame).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Grant camera" }));

    expect(await screen.findByText("Granted")).toBeInTheDocument();
    expect(newGame).toBeEnabled();
  });

  it("enables New game when the camera is already granted", async () => {
    permissionQuery("granted");
    renderLanding(cameraGame);

    expect(await screen.findByText("Granted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });

  it("asks for a grant when the browser cannot report the camera permission", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    getUserMedia();
    renderLanding(cameraGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grant camera" }));

    expect(await screen.findByText("Granted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });

  it("keeps New game disabled when the grant is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    permissionQuery("denied");
    getUserMedia(new Error("NotAllowedError"));
    renderLanding(cameraGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grant camera" }));

    expect(await screen.findByRole("button", { name: "Grant camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
  });

  it("hides Continue when no progress is saved", () => {
    renderLanding();

    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("offers Continue when progress is saved, and starts the saved game", () => {
    saveGameState(GAME_ID, partlyComplete());
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Playing the game")).toBeInTheDocument();
  });

  it("clears saved progress when starting a new game", () => {
    saveGameState(GAME_ID, partlyComplete());
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(screen.getByText("Playing the game")).toBeInTheDocument();
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("keeps Continue disabled until required permissions are granted", async () => {
    saveGameState(GAME_ID, partlyComplete());
    permissionQuery("prompt");
    getUserMedia();
    renderLanding(cameraGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Grant camera" }));

    expect(await screen.findByText("Granted")).toBeInTheDocument();
    expect(continueButton).toBeEnabled();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
  });
});
