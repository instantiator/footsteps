import { describe, expect, it } from "vitest";
import type { GameSource } from "../src/entities/GameSource";
import { resolveTemplateURL } from "../src/providers/GameContentCacheHook";
import { simpleRepository } from "./data/SampleGameState";

const local: GameSource = { type: "LocalRepository", path: "game-repository.json" };
const remote: GameSource = { type: "RemoteRepository", src: new URL("https://example.com/games/repo.json") };
const raw: GameSource = { type: "RawRepository", repository: simpleRepository };

describe("resolveTemplateURL", () => {
  it("resolves local and relative sources against the site for a local repository", () => {
    const site = new URL(import.meta.env.BASE_URL, window.location.origin);
    expect(resolveTemplateURL("local", "games/t.hbs", local)).toBe(new URL("games/t.hbs", site).toString());
    expect(resolveTemplateURL("relative", "t.hbs", local)).toBe(new URL("t.hbs", site).toString());
  });

  it("resolves relative sources against a remote repository's directory", () => {
    expect(resolveTemplateURL("relative", "t.hbs", remote)).toBe("https://example.com/games/t.hbs");
  });

  it("resolves parent-directory paths against the remote repository's directory", () => {
    expect(resolveTemplateURL("relative", "../t.hbs", remote)).toBe("https://example.com/t.hbs");
  });

  it("rejects local sources from a remote repository", () => {
    expect(() => resolveTemplateURL("local", "t.hbs", remote)).toThrow("does not support local");
  });

  it("rejects local and relative sources from a raw repository", () => {
    expect(() => resolveTemplateURL("local", "t.hbs", raw)).toThrow("Raw repository does not support local");
    expect(() => resolveTemplateURL("relative", "t.hbs", raw)).toThrow("Raw repository does not support relative");
  });
});
