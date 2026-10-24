import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkGamePermission,
  gamePermissionLabel,
  requestGamePermission,
  requiredGamePermissions,
} from "../src/components/core/logic/GamePermissionUtils";
import type { GameData } from "../src/entities/data/GameData";
import { smallGame } from "./data/SmallGame";
import { stubGetUserMedia, stubPermissionQuery, type PermissionQueryResult } from "./helpers/permissions";

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
  restores.forEach((restore) => restore());
  restores.length = 0;
  vi.restoreAllMocks();
});

/** The small game with a shared display added to its first stage. */
const gameWithStageDisplay: GameData = {
  ...smallGame,
  stages: smallGame.stages.map((stage, index) =>
    index === 0
      ? {
          ...stage,
          displays: [
            {
              purpose: "shared",
              camera: { enabled: true },
              component: { type: "template", data: {}, foregroundTemplate: { sourceType: "embedded", content: "" } },
            },
          ],
        }
      : stage,
  ),
};

describe("requiredGamePermissions", () => {
  it("needs no permissions when the game never enables the camera", () => {
    expect(requiredGamePermissions(smallGame)).toEqual([]);
  });

  it("needs the camera when the game module enables it", () => {
    const game: GameData = { ...smallGame, modules: { camera: { enabled: true } } };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when an overview display enables it", () => {
    const game: GameData = {
      ...smallGame,
      displays: smallGame.displays.map((display) => ({ ...display, camera: { enabled: true } })),
    };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when a stage display enables it", () => {
    expect(requiredGamePermissions(gameWithStageDisplay)).toEqual(["camera"]);
  });

  it("needs the camera when a challenge display enables it", () => {
    const game: GameData = {
      ...smallGame,
      stages: smallGame.stages.map((stage) => ({
        ...stage,
        challenges: stage.challenges.map((challenge) => ({
          ...challenge,
          displays: challenge.displays.map((display) => ({ ...display, camera: { enabled: true } })),
        })),
      })),
    };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("labels the camera permission", () => {
    expect(gamePermissionLabel("camera")).toBe("Camera");
  });
});

describe("checkGamePermission", () => {
  it.each(["granted", "prompt", "denied"] as const)("reports the browser's %s state", async (state) => {
    permissionQuery(state);
    await expect(checkGamePermission("camera")).resolves.toBe(state);
  });

  it("reports unsupported when the browser cannot query the permission", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    await expect(checkGamePermission("camera")).resolves.toBe("unsupported");
  });
});

describe("requestGamePermission", () => {
  it("asks for the camera and reports it granted", async () => {
    permissionQuery("granted");
    const camera = getUserMedia();

    await expect(requestGamePermission("camera")).resolves.toBe("granted");
    expect(camera.getUserMedia).toHaveBeenCalledOnce();
  });

  it("keeps a successful request granted when the browser still reports prompt", async () => {
    permissionQuery("prompt");
    getUserMedia();

    await expect(requestGamePermission("camera")).resolves.toBe("granted");
  });

  it("reports the browser state when the request fails", async () => {
    permissionQuery("denied");
    getUserMedia(new Error("NotAllowedError"));

    await expect(requestGamePermission("camera")).resolves.toBe("denied");
  });

  it("reports unsupported when the request fails and the browser cannot query", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    getUserMedia(new Error("NotAllowedError"));

    await expect(requestGamePermission("camera")).resolves.toBe("unsupported");
  });
});
