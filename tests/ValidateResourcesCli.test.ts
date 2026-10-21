import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { GameData, GameResourceDefinitions } from "../src/entities/data/GameData";
import type { GameRepository } from "../src/entities/GameRepository";

const CLI = resolve("scripts/validate-resources.ts");

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the CLI in a child process, as the shell scripts and users do. */
const runCli = (args: string[]): RunResult => {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

/** Runs a test against a fresh temporary directory, which is removed afterwards. */
const withTempDir = (test: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "validate-resources-"));
  try {
    test(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Writes a JSON or text fixture, creating its parent directories. */
const writeFixture = (path: string, contents: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof contents === "string" ? contents : JSON.stringify(contents));
};

/** A game with no displays or stages unless the test supplies them. */
const gameWith = (data: Partial<GameData>): GameData => ({
  title: "Test game",
  displays: [],
  stages: [],
  gameContainerStyle: {},
  ...data,
});

/** A repository holding one game. */
const repositoryWith = (resources: GameResourceDefinitions): GameRepository => ({
  games: { "test-game": gameWith({ resources }) },
});

describe("validate-resources CLI", () => {
  it("passes a repository whose resource files exist", () => {
    withTempDir((dir) => {
      const site = join(dir, "site");
      writeFixture(join(site, "games", "pic.png"), "image");
      const repository = join(dir, "public", "game-repository.json");
      writeFixture(repository, repositoryWith({ pic: { type: "local", target: "games/pic.png" } }));

      const result = runCli(["repository", repository, "--site-root", site, "--skip-urls"]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("0 problems found");
      expect(result.stderr).toBe("");
    });
  });

  it("fails with the field's path when a resource file is missing", () => {
    withTempDir((dir) => {
      const site = join(dir, "site");
      const repository = join(dir, "public", "game-repository.json");
      writeFixture(repository, repositoryWith({ pic: { type: "local", target: "games/missing.png" } }));

      const result = runCli(["repository", repository, "--site-root", site, "--skip-urls"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("games.test-game.resources.pic.target: file not found:");
      expect(result.stderr).toContain(join(site, "games", "missing.png"));
      expect(result.stdout).toContain("1 problem found");
    });
  });

  it("passes a standalone game, resolving relative targets against the site root", () => {
    withTempDir((dir) => {
      const site = join(dir, "site");
      writeFixture(join(site, "games", "pic.png"), "image");
      const game = join(dir, "game.json");
      writeFixture(game, gameWith({ resources: { pic: { type: "relative", target: "games/pic.png" } } }));

      const result = runCli(["game", game, "--site-root", site]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("0 problems found");
    });
  });

  it("only requests URLs when URL checks are not skipped", () => {
    withTempDir((dir) => {
      const game = join(dir, "game.json");
      writeFixture(game, gameWith({ resources: { media: { type: "url", target: "http://127.0.0.1:1/media.mp3" } } }));
      const args = ["game", game, "--site-root", dir];

      const skipped = runCli([...args, "--skip-urls"]);
      expect(skipped.status).toBe(0);
      expect(skipped.stdout).toContain("URL checks skipped");

      const checked = runCli(args);
      expect(checked.status).toBe(1);
      expect(checked.stderr).toContain("could not be reached");
    });
  });

  it("exits 2 with usage when the arguments are wrong", () => {
    const result = runCli(["nonsense"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("expected a mode");
    expect(result.stderr).toContain("Usage:");
  });

  it("exits 2 when the file is not valid JSON", () => {
    withTempDir((dir) => {
      const repository = join(dir, "broken.json");
      writeFixture(repository, "{ not json");

      const result = runCli(["repository", repository]);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("could not parse");
    });
  });
});
