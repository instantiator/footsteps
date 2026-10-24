import { describe, expect, it } from "vitest";
import {
  checkGame,
  checkRepository,
  resolveTargetOnDisk,
  type CheckOptions,
  type UrlRequest,
} from "../scripts/resource-checks.ts";
import type { GameData, GameResourceDefinitions } from "../src/entities/data/GameData";
import type { GameDisplayComponentData, GameOverviewDisplay } from "../src/entities/data/displays/GameDisplayData";
import type { GameRepository } from "../src/entities/GameRepository";

const SITE_ROOT = "/site";
const REPO_ROOT = "/repo";

/** A URL request that always succeeds. */
const OK: UrlRequest = async () => ({ ok: true, status: 200, statusText: "OK" });

interface FakeOptions extends CheckOptions {
  /** Every URL the checks asked for, in order. */
  requested: string[];
}

/** Check options backed by a list of existing files and a stubbed URL request. */
const optionsWith = (files: string[] = [], request: UrlRequest = OK, skipUrls = false): FakeOptions => {
  const requested: string[] = [];
  return {
    siteRoot: SITE_ROOT,
    repositoryRoot: REPO_ROOT,
    skipUrls,
    fileExists: async (path) => files.includes(path),
    request: async (url) => {
      requested.push(url);
      return request(url);
    },
    requested,
  };
};

/** A game with no displays or stages unless the test supplies them. */
const gameWith = (data: Partial<GameData>): GameData => ({
  title: "Test game",
  description: "A game for tests.",
  displays: [],
  stages: [],
  gameContainerStyle: {},
  ...data,
});

/** An overview display wrapping a component. */
const displayWith = (component: GameDisplayComponentData): GameOverviewDisplay => ({
  purpose: "game-overview-title",
  component,
});

/** A template display with the given foreground template source. */
const templateDisplay = (foreground: GameDisplayComponentData["foregroundTemplate"]): GameOverviewDisplay =>
  displayWith({ type: "template", data: {}, foregroundTemplate: foreground });

describe("resolveTargetOnDisk", () => {
  it("resolves local targets against the site root and relative ones against the repository root", () => {
    const roots = { siteRoot: SITE_ROOT, repositoryRoot: REPO_ROOT };
    expect(resolveTargetOnDisk("local", "games/a.png", roots)).toEqual({ path: "/site/games/a.png" });
    expect(resolveTargetOnDisk("relative", "games/a.png", roots)).toEqual({ path: "/repo/games/a.png" });
  });

  it("rejects empty, absolute and URL targets, and any that escape their root", () => {
    const roots = { siteRoot: SITE_ROOT, repositoryRoot: REPO_ROOT };
    for (const target of [
      "",
      "/etc/passwd",
      "../outside.png",
      "games/../../outside.png",
      "https://example.com/a.png",
    ]) {
      expect(resolveTargetOnDisk("local", target, roots)).toHaveProperty("problem");
    }
    expect(resolveTargetOnDisk("local", "../outside.png", roots)).toEqual({
      problem: "target resolves outside the site root: ../outside.png",
    });
  });
});

describe("checkGame", () => {
  it("passes when every resource file and template is where the data says", async () => {
    const game = gameWith({
      resources: {
        local: { type: "local", target: "games/local.png" },
        relative: { type: "relative", target: "games/relative.png" },
      },
      displays: [templateDisplay({ sourceType: "relative", templateSource: "views/overview.hbs" })],
    });

    const result = await checkGame(
      game,
      optionsWith(["/site/games/local.png", "/repo/games/relative.png", "/repo/views/overview.hbs"]),
    );

    expect(result).toEqual({ problems: [], checked: { files: 3, urls: 0, names: 0 } });
  });

  it("reports a missing file with the field's path and resolved location", async () => {
    const game = gameWith({ resources: { missing: { type: "local", target: "games/missing.png" } } });

    const result = await checkGame(game, optionsWith());

    expect(result.problems).toEqual([
      { path: "resources.missing.target", message: "file not found: /site/games/missing.png" },
    ]);
  });

  it("reports a target that resolves outside its root", async () => {
    const game = gameWith({ resources: { outside: { type: "relative", target: "../outside.png" } } });

    const result = await checkGame(game, optionsWith());

    expect(result.problems).toEqual([
      {
        path: "resources.outside.target",
        message: "target resolves outside the repository root: ../outside.png",
      },
    ]);
  });

  it("ignores embedded templates and reports a template source that is missing", async () => {
    const embedded = gameWith({
      displays: [templateDisplay({ sourceType: "embedded", content: "<p>hello</p>" })],
    });
    expect((await checkGame(embedded, optionsWith())).checked.files).toBe(0);

    const noSource = gameWith({ displays: [templateDisplay({ sourceType: "local" })] });
    expect((await checkGame(noSource, optionsWith())).problems).toEqual([
      { path: "displays[0].component.foregroundTemplate.templateSource", message: "templateSource is missing" },
    ]);
  });

  it("checks displays inside stages and challenges", async () => {
    const game = gameWith({
      stages: [
        {
          id: "stage-1",
          challenges: [
            {
              id: "challenge-1",
              solution: { answers: ["custard"] },
              displays: [
                {
                  purpose: "challenge-in-progress",
                  component: {
                    type: "template",
                    data: {},
                    foregroundTemplate: { sourceType: "relative", templateSource: "views/challenge.hbs" },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await checkGame(game, optionsWith(["/repo/views/challenge.hbs"]));

    expect(result.problems).toEqual([]);
    expect(result.checked.files).toBe(1);
  });
});

describe("URL targets", () => {
  const urlGame = gameWith({ resources: { font: { type: "url", target: "https://example.com/font.css" } } });

  it("passes a URL that responds, and returns to it once", async () => {
    const options = optionsWith();
    const result = await checkGame(urlGame, options);

    expect(result).toEqual({ problems: [], checked: { files: 0, urls: 1, names: 0 } });
    expect(options.requested).toEqual(["https://example.com/font.css"]);
  });

  it("reports a status and a network failure differently", async () => {
    const notFound = await checkGame(
      urlGame,
      optionsWith([], async () => ({ ok: false, status: 404, statusText: "Not Found" })),
    );
    expect(notFound.problems).toEqual([
      { path: "resources.font.target", message: "https://example.com/font.css returned 404 Not Found" },
    ]);

    const unreachable = await checkGame(
      urlGame,
      optionsWith([], async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    expect(unreachable.problems).toEqual([
      { path: "resources.font.target", message: "https://example.com/font.css could not be reached: ECONNREFUSED" },
    ]);
  });

  it("rejects targets that are not absolute http(s) URLs, without requesting them", async () => {
    const options = optionsWith();
    const game = gameWith({
      resources: {
        file: { type: "url", target: "file:///etc/passwd" },
        relative: { type: "url", target: "font.css" },
      },
    });

    const result = await checkGame(game, options);

    expect(result.problems.map((problem) => problem.message)).toEqual([
      "target must use http or https: file:///etc/passwd",
      "target is not an absolute URL: font.css",
    ]);
    expect(options.requested).toEqual([]);
  });

  it("checks only the URL's form when URL checks are skipped", async () => {
    const options = optionsWith([], OK, true);
    const result = await checkGame(urlGame, options);

    expect(result.problems).toEqual([]);
    expect(result.checked.urls).toBe(1);
    expect(options.requested).toEqual([]);
  });

  it("requests a URL shared by several references only once", async () => {
    const options = optionsWith();
    const game = gameWith({
      resources: {
        one: { type: "url", target: "https://example.com/font.css" },
        two: { type: "url", target: "https://example.com/font.css" },
      },
    });

    const result = await checkGame(game, options);

    expect(result.checked.urls).toBe(2);
    expect(options.requested).toEqual(["https://example.com/font.css"]);
  });
});

describe("resource names", () => {
  const resources: GameResourceDefinitions = { known: { type: "local", target: "games/known.png" } };

  it("accepts names that are defined", async () => {
    const game = gameWith({
      resources,
      stylesheets: ["known"],
      tileGraphic: "known",
      sounds: { openingMusicResource: "known" },
      displays: [
        displayWith({
          type: "dialog",
          data: {},
          imageResource: "known",
          contents: [
            {
              media: {
                type: "audio",
                resource: "known",
                stillImageResource: "known",
                motionImageResource: "known",
              },
            },
          ],
        }),
      ],
    });

    const result = await checkGame(game, optionsWith(["/site/games/known.png"]));

    expect(result.problems).toEqual([]);
    expect(result.checked.names).toBe(7);
  });

  it("reports every undefined name with its field's path", async () => {
    const game = gameWith({
      resources,
      stylesheets: ["known", "missing-sheet"],
      tileGraphic: "missing-tile",
      sounds: { openingMusicResource: "missing-music" },
      displays: [
        displayWith({
          type: "dialog",
          data: {},
          imageResource: "missing-image",
          contents: [
            {
              media: {
                type: "audio",
                resource: "missing-audio",
                stillImageResource: "missing-still",
                motionImageResource: "known",
              },
            },
          ],
        }),
      ],
    });

    const result = await checkGame(game, optionsWith(["/site/games/known.png"]));

    expect(result.problems.map((problem) => problem.path).sort()).toEqual(
      [
        "displays[0].component.contents[0].media.resource",
        "displays[0].component.contents[0].media.stillImageResource",
        "displays[0].component.imageResource",
        "sounds.openingMusicResource",
        "stylesheets[1]",
        "tileGraphic",
      ].sort(),
    );
    expect(result.problems.map((problem) => problem.message)).toContain('refers to undefined resource "missing-audio"');
  });
});

describe("stage links", () => {
  /** A stages overview linking each element id to the given stage. */
  const stagesOverview = (links: Record<string, string>): GameOverviewDisplay => ({
    purpose: "game-overview-stages",
    component: { type: "template", data: {} },
    clickIdToStageId: Object.fromEntries(Object.entries(links).map(([elementId, stage]) => [elementId, { stage }])),
  });

  const stages: GameData["stages"] = [
    { id: "stage-1", challenges: [] },
    { id: "stage-2", challenges: [] },
  ];

  it("accepts links to the game's stages", async () => {
    const game = gameWith({ stages, displays: [stagesOverview({ "link-1": "stage-1", "link-2": "stage-2" })] });

    expect((await checkGame(game, optionsWith())).problems).toEqual([]);
  });

  it("reports a link to a stage the game doesn't have", async () => {
    const game = gameWith({ stages, displays: [stagesOverview({ "link-1": "stage-1", "link-9": "stage-9" })] });

    expect((await checkGame(game, optionsWith())).problems).toEqual([
      { path: "displays[0].clickIdToStageId.link-9.stage", message: 'refers to undefined stage "stage-9"' },
    ]);
  });
});

describe("checkRepository", () => {
  it("checks every game and prefixes each path with its game id", async () => {
    const repository: GameRepository = {
      games: {
        one: gameWith({ resources: { missing: { type: "local", target: "games/missing.png" } } }),
        two: gameWith({ resources: { present: { type: "local", target: "games/present.png" } } }),
      },
    };

    const result = await checkRepository(repository, optionsWith(["/site/games/present.png"]));

    expect(result.problems).toEqual([
      { path: "games.one.resources.missing.target", message: "file not found: /site/games/missing.png" },
    ]);
    expect(result.checked.files).toBe(2);
  });

  it("requests a URL shared by two games only once", async () => {
    const font = { type: "url" as const, target: "https://example.com/font.css" };
    const repository: GameRepository = {
      games: { one: gameWith({ resources: { font } }), two: gameWith({ resources: { font } }) },
    };
    const options = optionsWith();

    const result = await checkRepository(repository, options);

    expect(result.checked.urls).toBe(2);
    expect(options.requested).toEqual(["https://example.com/font.css"]);
  });
});
