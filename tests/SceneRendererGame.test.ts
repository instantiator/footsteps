import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { checkRepository } from "../scripts/resource-checks.ts";
import { STARTER_SCENE, sceneRendererRepository } from "../src/pages/SceneRendererGame";

const schema = JSON.parse(readFileSync("public/schemas/game-repository-schema.json", "utf8"));

describe("sceneRendererRepository", () => {
  const repository = sceneRendererRepository(STARTER_SCENE);

  it("matches the repository schema, so the renderer plays what a real game could", () => {
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
    expect(validate(repository), JSON.stringify(validate.errors)).toBe(true);
  });

  it("gives the starter scene no problems or warnings", async () => {
    const result = await checkRepository(repository, {
      siteRoot: "/",
      repositoryRoot: "/",
      skipUrls: true,
      fileExists: async () => true,
      request: async () => ({ ok: true, status: 200, statusText: "OK" }),
    });
    expect([...result.problems, ...result.warnings]).toEqual([]);
  });
});
