import { describe, expect, it } from "vitest";
import { renamedKeyProblems } from "../src/components/core/logic/RenamedKeys";
import { compileGameRules } from "../src/components/core/logic/GameRuleCompile";
import type { GameData } from "../src/entities/data/GameData";
import { challenge, game, stage } from "./data/GameBuilders";

/** Game data from before scenes were renamed, as it would arrive from JSON. */
const oldGame = (): unknown => {
  const data: Record<string, unknown> = { ...game(["game-overview-title"], [stage("lava", [challenge("floor")])]) };
  data.displays = data.scenes;
  delete data.scenes;
  return data;
};

describe("renamedKeyProblems", () => {
  it("finds nothing in current game data", () => {
    expect(renamedKeyProblems(game(["game-overview-title"], [stage("lava", [challenge("floor")])]))).toEqual([]);
  });

  it("names the new key for a top-level displays", () => {
    expect(renamedKeyProblems(oldGame())).toEqual(['game: "displays" is now "scenes"']);
  });

  it("names the path of a nested resetDisplay, including one inside a reset scene", () => {
    const data = {
      stages: [{ challenges: [{ scenes: [{ resetScene: { resetDisplay: {} } }, { resetDisplay: {} }] }] }],
    };
    expect(renamedKeyProblems(data)).toEqual([
      'stages[0].challenges[0].scenes[0].resetScene: "resetDisplay" is now "resetScene"',
      'stages[0].challenges[0].scenes[1]: "resetDisplay" is now "resetScene"',
    ]);
  });

  it("leaves the author's own data and state alone", () => {
    expect(renamedKeyProblems({ component: { data: { displays: 3 }, initialState: { resetDisplay: true } } })).toEqual(
      [],
    );
  });

  it("fails loading old game data, naming the new key", () => {
    const old: GameData = JSON.parse(JSON.stringify(oldGame()));
    expect(() => compileGameRules(old)).toThrow('game: "displays" is now "scenes"');
  });
});
