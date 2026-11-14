import type { Page } from "@playwright/test";
import { DEFAULT_CORNERS, type Corners } from "../../../src/components/camera/FloorGeometry";
import type { GameSceneMode } from "../../../src/entities/data/scenes/GameSceneData";
import type { GameRepository } from "../../../src/entities/GameRepository";
import { installCameraDrawCounter } from "./cameraDraws";
import { installFakeCamera } from "./fakeCamera";

/** How long the vision model may take to download, start, and draw its first frames. */
export const MODEL_TIMEOUT = 120_000;

/** The only game in the repository, patched to switch camera mode on for a test. */
const GAME_ID = "magic-trifle";

/** How the camera behaves on the game's scenes. */
export interface CameraGameOptions {
  /** Whether the preview shows; defaults to true. */
  preview?: boolean;
  /** A stage whose shared scene turns the camera off. */
  cameraOffStage?: string;
  /** Appended to the game's URL, eg. "?debug=true". */
  query?: string;
  /** Photos for the fake camera to show; see {@link installFakeCamera}. */
  photos?: Record<string, string>;
  /** The fake camera's resolution; see {@link installFakeCamera}. */
  cameraSize?: { width: number; height: number };
  /** How the game's scenes are laid out; the game's own setting if omitted. */
  sceneMode?: GameSceneMode;
}

/**
 * Saves a floor calibration for a camera before the page loads, as a player would on the calibration page, so a game
 * with 2.5D scenes can start. It is saved again on every page load.
 * @param cameraKey the camera chosen on the landing page; the system default if omitted
 */
export const seedCalibration = async (page: Page, corners: Corners = DEFAULT_CORNERS, cameraKey = "default") => {
  await page.addInitScript(
    ({ key, saved }) => localStorage.setItem("footsteps:floor-calibration", JSON.stringify({ [key]: saved })),
    { key: cameraKey, saved: corners },
  );
};

/** Intercepts the repository and switches camera mode on, with the options the test needs. */
const patchRepository = async (page: Page, options: CameraGameOptions): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games[GAME_ID];
    game.modules = { ...game.modules, avatar: { mode: "camera", fallback: "mouse", preview: options.preview ?? true } };
    if (options.sceneMode) game.modules.scene = options.sceneMode;

    if (options.cameraOffStage) {
      const stage = game.stages.find(({ id }) => id === options.cameraOffStage);
      const scene = stage?.scenes?.[0];
      if (!scene) throw new Error(`no scene on stage ${options.cameraOffStage}`);
      scene.avatar = { mode: "mouse" };
    }

    await route.fulfill({ response, json: repository });
  });
};

/** Loads the game with a fake camera, and motion off so transitions are immediate. */
export const openCameraGame = async (page: Page, options: CameraGameOptions = {}): Promise<void> => {
  await page.context().grantPermissions(["camera"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installFakeCamera(page, options.photos, options.cameraSize);
  await installCameraDrawCounter(page);
  await patchRepository(page, options);
  await seedCalibration(page); // the game is 2.5D unless a test says otherwise, so a granted camera needs a floor
  await page.goto(`/game/${GAME_ID}/play${options.query ?? ""}`);
};
