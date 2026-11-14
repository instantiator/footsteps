import { describe, expect, it } from "vitest";
import { gameBadges } from "../src/components/core/logic/GameBadgeUtils";
import { completeChallenge } from "../src/components/core/logic/GameStateUtils";
import type { GameData } from "../src/entities/data/GameData";
import { createBlankGameState } from "../src/entities/state/GameState";
import { simpleGameData } from "./data/SampleGameState";

/** The sample game (3 stages, 4 challenges, no settings) with some changes. */
const game = (changes: Partial<GameData> = {}): GameData => ({ ...simpleGameData, ...changes });

/** The sample game with a scene mode on its title scene. */
const withTitleScene = (scene: "2D" | "2.5D"): GameData =>
  game({ scenes: simpleGameData.scenes.map((s) => ({ ...s, scene })) });

/** A saved game with these challenges solved. */
const savedWith = (...solved: [string, string][]) =>
  solved.reduce(
    (state, [stage, challenge]) => completeChallenge(state, stage, challenge),
    createBlankGameState(simpleGameData),
  );

describe("gameBadges", () => {
  it("describes a game with no settings as 2D, with no camera and no sound, and counts its size", () => {
    expect(gameBadges(game())).toEqual(["2D", "No camera", "3 stages · 4 challenges", "Silent"]);
  });

  it("lists every scene mode the game uses, in order", () => {
    expect(gameBadges(game({ modules: { scene: "2.5D" } })).slice(0, 2)).toEqual(["2.5D", "No camera"]);
    expect(gameBadges({ ...withTitleScene("2.5D"), modules: { scene: "2D" } }).slice(0, 2)).toEqual(["2D", "2.5D"]);
  });

  it.each([
    ["Camera", { avatar: { mode: "camera" as const } }],
    ["Camera optional", { avatar: { mode: "camera" as const, fallback: "mouse-feet" as const } }],
    ["No camera", { avatar: { mode: "mouse-feet" as const } }],
  ])("says %s from the game's avatar modes", (badge, modules) => {
    expect(gameBadges(game({ modules }))).toContain(badge);
  });

  it("says a scene requiring the camera makes the game need it, whatever the game's own setting", () => {
    const scenes = simpleGameData.scenes.map((s) => ({ ...s, avatar: { mode: "camera" as const } }));
    expect(gameBadges(game({ scenes, modules: { avatar: { mode: "mouse" } } }))).toContain("Camera");
  });

  it("shows progress only for a saved game, as a whole percentage of its challenges", () => {
    expect(gameBadges(game()).some((badge) => badge.endsWith("% complete"))).toBe(false);
    expect(gameBadges(game(), savedWith())).toContain("0% complete");
    expect(gameBadges(game(), savedWith(["stage-1", "stage-1-challenge-1"]))).toContain("25% complete");
    expect(
      gameBadges(
        game(),
        savedWith(
          ["stage-1", "stage-1-challenge-1"],
          ["stage-2", "stage-2-challenge-1"],
          ["stage-2", "stage-2-challenge-2"],
          ["stage-3", "stage-3-challenge-1"],
        ),
      ),
    ).toContain("100% complete");
  });

  it.each([
    ["Music", { openingMusicResource: "tune" }],
    ["Sound effects", { stageCompletedSoundResource: "ding" }],
    ["Music and sound effects", { closingMusicResource: "tune", stageOpenedSoundResource: "ding" }],
  ])("says %s from the game's sounds", (badge, sounds) => {
    expect(gameBadges(game({ sounds })).at(-1)).toBe(badge);
  });

  it("counts a rule's sound action as a sound effect", () => {
    const scenes = simpleGameData.scenes.map((s) => ({
      ...s,
      component: { ...s.component, rules: [{ on: { start: true as const }, do: [{ sound: "pop" }] }] },
    }));
    expect(gameBadges(game({ scenes })).at(-1)).toBe("Sound effects");
  });

  it("says 1 stage and 1 challenge in the singular", () => {
    expect(gameBadges(game({ stages: simpleGameData.stages.slice(0, 1) }))).toContain("1 stage · 1 challenge");
  });
});
