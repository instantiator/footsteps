import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve("scripts/validate-schema.ts");
const SCHEMA = resolve("public/schemas/game-repository-schema.json");

/** Runs the CLI in a child process against the given data, as the validate scripts do. */
const validate = (data: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), "validate-schema-"));
  try {
    const file = join(dir, "data.json");
    writeFileSync(file, JSON.stringify(data));
    return spawnSync(process.execPath, [CLI, SCHEMA, file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("validate-schema CLI", () => {
  it("passes data that matches the schema", () => {
    const result = validate({ games: {} });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("valid");
  });

  it("fails data that doesn't, listing every error", () => {
    const result = validate({ games: { broken: { title: 5 } } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("data/games/broken/title must be string");
    expect(result.stderr).toContain("must have required property 'stages'");
  });

  it("explains its usage when a file is missing", () => {
    const result = spawnSync(process.execPath, [CLI, SCHEMA], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
  });
});
