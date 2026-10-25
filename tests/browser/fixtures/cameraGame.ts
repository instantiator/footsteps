import type { Page } from "@playwright/test";
import type { GameRepository } from "../../../src/entities/GameRepository";
import { installCameraDrawCounter } from "./cameraDraws";
import { installFakeCamera } from "./fakeCamera";

/** How long the vision model may take to download, start, and draw its first frames. */
export const MODEL_TIMEOUT = 120_000;

/** The only game in the repository, patched to switch camera mode on for a test. */
const GAME_ID = "magic-trifle";

/** How the camera behaves on the game's displays. */
export interface CameraGameOptions {
  /** Whether the preview shows; defaults to true. */
  preview?: boolean;
  /** A stage whose shared display turns the camera off. */
  cameraOffStage?: string;
  /** Appended to the game's URL, eg. "?debug=true". */
  query?: string;
  /** Photos for the fake camera to show; see {@link installFakeCamera}. */
  photos?: Record<string, string>;
  /** The fake camera's resolution; see {@link installFakeCamera}. */
  cameraSize?: { width: number; height: number };
}

/** Intercepts the repository and switches camera mode on, with the options the test needs. */
const patchRepository = async (page: Page, options: CameraGameOptions): Promise<void> => {
  await page.route("**/game-repository.json", async (route) => {
    const response = await route.fetch();
    const repository = (await response.json()) as GameRepository;
    const game = repository.games[GAME_ID];
    game.modules = { ...game.modules, camera: { enabled: true, preview: options.preview ?? true } };

    if (options.cameraOffStage) {
      const stage = game.stages.find(({ id }) => id === options.cameraOffStage);
      const display = stage?.displays?.[0];
      if (!display) throw new Error(`no display on stage ${options.cameraOffStage}`);
      display.camera = { enabled: false };
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
  await page.goto(`/game/${GAME_ID}/play${options.query ?? ""}`);
};
