import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkGamePermission,
  gamePermissionLabel,
  requestGamePermission,
  requiredGamePermissions,
  usedGamePermissions,
} from "../src/components/core/logic/GamePermissionUtils";
import type { GameData } from "../src/entities/data/GameData";
import { smallGame } from "./data/SmallGame";
import {
  FakePermissionStatus,
  stubGetUserMedia,
  stubPermissionQuery,
  type PermissionQueryResult,
} from "./helpers/permissions";

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

/** The small game with a shared scene added to its first stage. */
const gameWithStageScene: GameData = {
  ...smallGame,
  stages: smallGame.stages.map((stage, index) =>
    index === 0
      ? {
          ...stage,
          scenes: [
            {
              purpose: "shared",
              avatar: { mode: "camera" },
              component: { type: "template", data: {}, foregroundTemplate: { sourceType: "embedded", content: "" } },
            },
          ],
        }
      : stage,
  ),
};

describe("requiredGamePermissions", () => {
  it("needs no permissions when the game never uses the camera", () => {
    expect(requiredGamePermissions(smallGame)).toEqual([]);
    expect(usedGamePermissions(smallGame)).toEqual([]);
  });

  it("uses the camera, but doesn't need it, when it is only enabled", () => {
    const game: GameData = { ...smallGame, modules: { avatar: { mode: "camera", fallback: "mouse" } } };
    expect(usedGamePermissions(game)).toEqual(["camera"]);
    expect(requiredGamePermissions(game)).toEqual([]);
  });

  it("neither uses nor needs the camera when everything turns it off", () => {
    const game: GameData = { ...smallGame, modules: { avatar: { mode: "mouse" } } };
    expect(usedGamePermissions(game)).toEqual([]);
    expect(requiredGamePermissions(game)).toEqual([]);
  });

  it("neither uses nor needs the camera for mouse-feet", () => {
    const game: GameData = { ...smallGame, modules: { avatar: { mode: "mouse-feet" } } };
    expect(usedGamePermissions(game)).toEqual([]);
    expect(requiredGamePermissions(game)).toEqual([]);
  });

  it("needs the camera when one scene requires it and another only enables it", () => {
    const [overview, ...others] = smallGame.scenes;
    const game: GameData = {
      ...smallGame,
      modules: { avatar: { mode: "camera", fallback: "mouse" } },
      scenes: [{ ...overview, avatar: { mode: "camera" } }, ...others],
    };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when a nested reset scene requires it", () => {
    const component = smallGame.scenes[0].component;
    const [overview, ...others] = smallGame.scenes;
    const game: GameData = {
      ...smallGame,
      scenes: [
        {
          ...overview,
          resetScene: { component, resetScene: { component, avatar: { mode: "camera" } } },
        },
        ...others,
      ],
    };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when the game module requires it", () => {
    const game: GameData = { ...smallGame, modules: { avatar: { mode: "camera" } } };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when an overview scene requires it", () => {
    const game: GameData = {
      ...smallGame,
      scenes: smallGame.scenes.map((scene) => ({ ...scene, avatar: { mode: "camera" } })),
    };
    expect(requiredGamePermissions(game)).toEqual(["camera"]);
  });

  it("needs the camera when a stage scene requires it", () => {
    expect(requiredGamePermissions(gameWithStageScene)).toEqual(["camera"]);
  });

  it("needs the camera when a challenge scene requires it", () => {
    const game: GameData = {
      ...smallGame,
      stages: smallGame.stages.map((stage) => ({
        ...stage,
        challenges: stage.challenges.map((challenge) => ({
          ...challenge,
          scenes: challenge.scenes.map((scene) => ({ ...scene, avatar: { mode: "camera" } })),
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

  it("reports a successful request granted later, when the browser cannot query", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    permissionQuery("error");
    getUserMedia();

    await expect(requestGamePermission("camera")).resolves.toBe("granted");
    await expect(checkGamePermission("camera")).resolves.toBe("granted");
  });

  it("reports a later denial even after a grant in this tab", async () => {
    const query = permissionQuery("granted");
    getUserMedia();
    await requestGamePermission("camera");

    query.query.mockResolvedValue(new FakePermissionStatus("camera", "denied"));
    await expect(checkGamePermission("camera")).resolves.toBe("denied");
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
