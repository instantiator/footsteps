import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraKeyOf, isCalibrated, saveCalibration } from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import GameLanding from "../src/components/landing/GameLanding";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState, type GameState } from "../src/entities/state/GameState";
import { loadGameState, saveGameState } from "../src/entities/state/GameStateStorage";
import { GameDataProvider } from "../src/providers/GameDataProvider";
import GameRepositoryProvider from "../src/providers/GameRepositoryProvider";
import { simpleGameData } from "./data/SampleGameState";
import { FakeMediaStream, FakeMediaStreamTrack } from "./helpers/media";
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

/** Stands in for the game, showing the query it was started with. */
const Playing = () => <p>Playing the game{useLocation().search}</p>;

/** Renders the landing page with a play route that stands in for the game. */
const renderLanding = (game: GameData = simpleGameData) =>
  render(
    <MemoryRouter initialEntries={[`/game/${GAME_ID}`]}>
      <GameRepositoryProvider source={{ type: "RawRepository", repository: { games: { [GAME_ID]: game } } }}>
        <GameDataProvider id={GAME_ID}>
          <Routes>
            <Route path="/game/:id" element={<GameLanding />} />
            <Route path="/game/:id/play" element={<Playing />} />
            <Route path="/game/:id/calibrate" element={<p>Calibrating</p>} />
          </Routes>
        </GameDataProvider>
      </GameRepositoryProvider>
    </MemoryRouter>,
  );

/** The landing page's camera dropdown, which also offers playing without the camera. */
const cameraDropdown = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Camera" });

const withoutCameraOption = () => screen.queryByRole("option", { name: /Play without the camera/ });

describe("GameLanding without the camera", () => {
  it("offers to play without the camera only for a game that can do without it", () => {
    renderLanding(cameraGame).unmount();
    expect(withoutCameraOption()).toBeNull();
    renderLanding(simpleGameData).unmount();
    expect(screen.queryByRole("combobox", { name: "Camera" })).toBeNull();
    renderLanding(optionalCameraGame);
    expect(withoutCameraOption()).not.toBeNull();
    expect(cameraDropdown().value).not.toBe("none");
  });

  it("starts without needing the floor calibrated, and tells the game to leave the camera off", async () => {
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);
    expect(await screen.findByText("Not yet calibrated")).toBeInTheDocument();

    fireEvent.change(cameraDropdown(), { target: { value: "none" } });
    expect(screen.queryByText("Not yet calibrated")).toBeNull();
    expect(screen.queryByRole("button", { name: "Calibrate" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(screen.getByText("Playing the game?noCamera=true")).toBeInTheDocument();
  });
});

describe("GameLanding badges", () => {
  it("shows the game's badges, with how far a saved game has got", () => {
    saveGameState(GAME_ID, partlyComplete());
    renderLanding(optionalCameraGame);
    const badges = screen.getByRole("list", { name: "About this game" });
    expect(badges).toHaveTextContent("2D");
    expect(badges).toHaveTextContent("Camera optional");
    expect(badges).toHaveTextContent("% complete");
  });
});

describe("GameLanding for a game with 2.5D scenes", () => {
  it("holds New game back until the camera's floor is calibrated, and links to calibrate it", async () => {
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);

    expect(await screen.findByText("Not yet calibrated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    expect(document.querySelector(".game-camera-preview polygon")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Calibrate" }));
    expect(screen.getByText("Calibrating")).toBeInTheDocument();
  });

  it("lets the player start once the camera has a saved floor, drawn on the preview, until it's cleared", async () => {
    saveCalibration(cameraKeyOf({}), DEFAULT_CORNERS);
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);

    await waitFor(() => expect(screen.getByRole("button", { name: "New game" })).toBeEnabled());
    expect(screen.queryByText("Not yet calibrated")).toBeNull();
    expect(document.querySelector(".game-camera-preview polygon")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Not yet calibrated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
    expect(document.querySelector(".game-camera-preview polygon")).toBeNull();
  });

  it("lets the player start with the default floor after Reset", async () => {
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);
    expect(await screen.findByText("Not yet calibrated")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByText("Not yet calibrated")).toBeNull();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
    expect(document.querySelector(".game-camera-preview polygon")).not.toBeNull();
  });

  it("clears every configuration's floor once the player confirms", async () => {
    saveCalibration(cameraKeyOf({}), DEFAULT_CORNERS);
    saveCalibration(cameraKeyOf({ size: { width: 640, height: 480 } }), DEFAULT_CORNERS);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    permissionQuery("granted");
    getUserMedia();
    renderLanding(floorGame);
    await waitFor(() => expect(screen.getByRole("button", { name: "New game" })).toBeEnabled());

    const clearAll = screen.getByRole("button", { name: "Clear all calibrations" });
    expect(clearAll.closest(".game-button-bar")).not.toBeNull();
    fireEvent.click(clearAll);

    expect(screen.getByText("Not yet calibrated")).toBeInTheDocument();
    expect(isCalibrated(cameraKeyOf({ size: { width: 640, height: 480 } }))).toBe(false);
  });

  it("lets a player without the camera start, to play by mouse", async () => {
    permissionQuery("prompt");
    renderLanding(floorGame);

    expect(await screen.findByText("Not granted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New game" })).toBeEnabled();
    expect(screen.queryByText("Not yet calibrated")).toBeNull();
  });

  it("says a required camera is needed over the preview", async () => {
    permissionQuery("prompt");
    renderLanding(cameraGame);
    expect(await screen.findByText("Camera required")).toBeInTheDocument();
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

  it("clears saved progress when starting a new game, once the player confirms", () => {
    saveGameState(GAME_ID, partlyComplete());
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(loadGameState(GAME_ID, simpleGameData)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Playing the game")).toBeInTheDocument();
    expect(loadGameState(GAME_ID, simpleGameData)).toBeUndefined();
  });

  it("starts a new game without asking when there's nothing saved", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText("Playing the game")).toBeInTheDocument();
  });

  it("plans the space for the camera in use, once the browser names it", async () => {
    permissionQuery("granted");
    const media = getUserMedia();
    media.getUserMedia.mockResolvedValue(new FakeMediaStream([new FakeMediaStreamTrack({ deviceId: "lifecam" })]));
    media.enumerateDevices.mockResolvedValue([
      { deviceId: "lifecam", label: "LifeCam HD-3000", kind: "videoinput", groupId: "g", toJSON: () => ({}) },
    ]);
    renderLanding(cameraGame);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Plan space" })).toHaveAttribute(
        "href",
        "/setup?camera=LifeCam+HD-3000&size=1280x720",
      ),
    );
  });

  it("offers to clear all calibrations only for a game that uses the floor", () => {
    renderLanding();
    expect(screen.queryByRole("button", { name: "Clear all calibrations" })).toBeNull();
  });

  it("starts the bar with a way back to the games", () => {
    renderLanding();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Back to games");
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links[0].closest(".game-button-bar")).not.toBeNull();
  });

  it("plans the space in a new tab", () => {
    renderLanding();
    const plan = screen.getByRole("link", { name: "Plan space" });
    expect(plan).toHaveAttribute("href", "/setup");
    expect(plan).toHaveAttribute("target", "_blank");
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
