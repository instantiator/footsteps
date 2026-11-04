import { afterEach, describe, expect, it, vi } from "vitest";
import localRepository from "../public/game-repository.json";
import { compileGameRules } from "../src/components/core/logic/GameRuleCompile";
import type { GameData } from "../src/entities/data/GameData";
import type { GameDisplayCameraData, GameRule } from "../src/entities/data/displays/GameDisplayData";
import type { GameEffect } from "../src/entities/data/displays/GameEffectData";
import type { GameRepository } from "../src/entities/GameRepository";
import { challenge, game, stage } from "./data/GameBuilders";

const ON_CAMERA: GameDisplayCameraData = { requirement: "enabled" };
const CHALLENGE_DISPLAY = "stages[0] (lava) › challenges[0] (floor) › displays[0] (challenge-in-progress)";
const RULE = `${CHALLENGE_DISPLAY} › rules[0]`;

/** A game whose only challenge display has the given rules, with the camera on unless the test says otherwise. */
const gameWith = (rules: GameRule[], camera: GameDisplayCameraData | undefined = ON_CAMERA): GameData => {
  const data = game(["game-overview-stages"], [stage("lava", [challenge("floor")])]);
  const [display] = data.stages[0].challenges[0].displays;
  display.component.rules = rules;
  display.camera = camera;
  return data;
};

/** Compiling a game whose challenge has one rule, firing on a click and doing this. */
const compilingEffect = (effect: GameEffect, camera?: GameDisplayCameraData) => () =>
  compileGameRules(gameWith([{ on: { interact: ["click"], target: "#a" }, do: [effect] }], camera));

/** Compiling a game whose challenge has one rule with this trigger. */
const compilingTrigger = (on: GameRule["on"]) => () => compileGameRules(gameWith([{ on, do: [] }]));

afterEach(() => vi.unstubAllGlobals());

describe("effects when the game loads", () => {
  it("accepts every effect with sensible values", () => {
    const effects: GameEffect[] = [
      { effect: "quake", target: "#a", dx: 1, dy: 1, durationMs: "indefinite", cycleMs: 100, easing: "ease-out" },
      { effect: "item-fall", durationMs: "indefinite", cycleMs: 1000 },
      { effect: "item-move", start: { left: 1, top: 2 }, end: { by: { left: 0, top: -10 } } },
      { effect: "item-move", end: { from: "#platform", left: 0, top: -10 } },
      {
        effect: "highlight",
        durationMs: "indefinite",
        sequence: [{ filter: "brightness(2)", shadow: "0 0 2cqw gold" }],
      },
      { effect: "highlight", target: ".player-1", sequence: [{ filter: "drop-shadow(0 0 1cqw gold)" }] },
      { effect: "quake", target: ".player", dx: 1 },
      { effect: "player-fall", durationMs: 1000 },
      { effect: "player-spin-away", angle: { min: -60, max: 60 }, zoom: 0.3, opacity: 0, rotations: 2 },
      { effect: "player-invisible", durationMs: 500 },
      { effect: "player-visible", players: "all" },
      { effect: "player-static", durationMs: "indefinite", pixelSize: 0.5, proportion: 0.6, easeMs: 500 },
      { effect: "player-freeze" },
      { effect: "player-unfreeze", delayMs: 3000 },
      { effect: "player-restore", players: "all", durationMs: 500 },
      { effect: "stop", target: "#a", stop: "highlight" },
      { effect: "stop", players: "all", stop: "player-static" },
    ];
    for (const effect of effects) expect(compilingEffect(effect)).not.toThrow();
  });

  it.each([
    ["an unknown effect", { effect: "wobble" } as unknown as GameEffect, 'there is no effect "wobble"'],
    ["a negative duration", { effect: "quake", durationMs: -1 }, "durationMs can't be negative"],
    ["a negative cycle", { effect: "item-fall", cycleMs: -1 }, "cycleMs can't be negative"],
    ["a target that doesn't parse", { effect: "quake", target: "##" }, '"##" is not a valid CSS selector'],
    ["a position's element that doesn't parse", { effect: "item-move", end: { from: "##", left: 0, top: 0 } }, '"##"'],
    ["indefinite falling", { effect: "player-fall", durationMs: "indefinite" }, "as it must finish"],
    ["indefinite spinning", { effect: "player-spin-away", durationMs: "indefinite" }, "as it must finish"],
    ["indefinite fading", { effect: "player-invisible", durationMs: "indefinite" }, "as it must finish"],
    ["indefinite showing", { effect: "player-visible", durationMs: "indefinite" }, "as it must finish"],
    ["indefinite restoring", { effect: "player-restore", durationMs: "indefinite" }, "as it must finish"],
    ["a move with no end", { effect: "item-move" } as unknown as GameEffect, "item-move needs an end"],
    ["a highlight with no sequence", { effect: "highlight" } as unknown as GameEffect, "needs a sequence"],
    ["an empty sequence", { effect: "highlight", sequence: [] }, "needs a sequence"],
    ["a negative step", { effect: "highlight", sequence: [{ durationMs: -1 }] }, "sequence[0].durationMs"],
    ["min above max", { effect: "player-spin-away", angle: { min: 10, max: 0 } }, "angle.min can't be above"],
    ["no zoom", { effect: "player-spin-away", zoom: 0 }, "zoom must be above 0"],
    ["too much opacity", { effect: "player-spin-away", opacity: 2 }, "opacity must be between"],
    ["no pixels", { effect: "player-static", pixelSize: 0 }, "pixelSize must be above 0"],
    ["too much static", { effect: "player-static", proportion: -1 }, "proportion must be between"],
    ["negative easing time", { effect: "player-static", easeMs: -1 }, "easeMs can't be negative"],
    ["a fall on a player", { effect: "item-fall", target: ".player-1" }, "use player-fall instead"],
    ["a move on a player", { effect: "item-move", target: ".player", end: { left: 0, top: 0 } }, "item-move would"],
    [
      "a shadow on a player",
      { effect: "highlight", target: ".player", sequence: [{ shadow: "0 0 1cqw gold" }] },
      "use filter: drop-shadow() instead",
    ],
    [
      "an outline on a player",
      { effect: "highlight", target: ".player-2", sequence: [{ outline: "1px solid red" }] },
      "use filter: drop-shadow() instead",
    ],
    ["stopping a fall", { effect: "stop", stop: "player-fall" }, "player-fall can't be stopped"],
    ["stopping a spin", { effect: "stop", stop: "player-spin-away" }, "player-spin-away can't be stopped"],
    ["stopping a freeze", { effect: "stop", stop: "player-freeze" }, "player-freeze can't be stopped"],
    ["stopping a stop", { effect: "stop", stop: "stop" }, "stop can't be stopped"],
    ["stopping nothing", { effect: "stop", stop: "wobble" }, 'there is no effect "wobble" to stop'],
  ] satisfies [string, GameEffect, string][])("rejects %s, naming the rule", (_, effect, message) => {
    expect(compilingEffect(effect)).toThrow(`${RULE}.do[0]: `);
    expect(compilingEffect(effect)).toThrow(message);
  });

  it("rejects an easing the browser can't parse, and accepts one it can", () => {
    vi.stubGlobal("CSS", { supports: (_: string, value: string) => value === "ease-in" });
    expect(compilingEffect({ effect: "quake", easing: "ease-in" })).not.toThrow();
    expect(compilingEffect({ effect: "quake", easing: "wobbly" })).toThrow(`${RULE}.do[0]: easing: "wobbly"`);
    expect(compilingEffect({ effect: "highlight", sequence: [{ easing: "wobbly" }] })).toThrow("sequence[0].easing");
  });

  it("rejects a reward whose target doesn't parse", () => {
    const rule: GameRule = {
      on: { interact: ["click"], target: "#a" },
      do: [{ reward: { animation: "stars" }, target: "##" }],
    };
    expect(() => compileGameRules(gameWith([rule]))).toThrow(`${RULE}.do[0]: target: "##"`);
  });
});

describe("triggers when the game loads", () => {
  it("lets jump alone leave out its target", () => {
    expect(compilingTrigger({ interact: "jump" })).not.toThrow();
    expect(compilingTrigger({ interact: ["jump"] })).not.toThrow();
  });

  it.each([
    ["another interaction", { interact: ["hand-enter"] }],
    ["jump with another interaction", { interact: ["jump", "click"] }],
    ["jump-from", { interact: "jump-from" }],
  ] satisfies [string, GameRule["on"]][])("makes %s name a target", (_, on) => {
    expect(compilingTrigger(on)).toThrow(`${RULE}.on.target: only "jump"`);
  });

  it("makes near interactions name a distance, and only them", () => {
    expect(compilingTrigger({ interact: ["near-enter"], target: "#a", within: 10 })).not.toThrow();
    expect(compilingTrigger({ interact: ["near-exit"], target: "#a" })).toThrow(`${RULE}.on.within: near interactions`);
    expect(compilingTrigger({ interact: ["click"], target: "#a", within: 10 })).toThrow("only near interactions");
    expect(compilingTrigger({ interact: ["near-enter"], target: "#a", within: -1 })).toThrow("can't be negative");
  });

  it("allows holdMs on near-enter, and not near-exit", () => {
    expect(compilingTrigger({ interact: ["near-enter"], target: "#a", within: 1, holdMs: 100 })).not.toThrow();
    expect(compilingTrigger({ interact: ["near-exit"], target: "#a", within: 1, holdMs: 100 })).toThrow(
      "only entering interactions can be held",
    );
  });

  it("checks an effect end names an effect, and its target", () => {
    expect(compilingTrigger({ effectEnd: "player-fall" })).not.toThrow();
    expect(compilingTrigger({ effectEnd: "item-fall", target: "#bridge" })).not.toThrow();
    expect(compilingTrigger({ effectEnd: "wobble" })).toThrow(`${RULE}.on.effectEnd: there is no effect "wobble"`);
    expect(compilingTrigger({ effectEnd: "stop" })).toThrow('there is no effect "stop"');
    expect(compilingTrigger({ effectEnd: "item-fall", target: "##" })).toThrow(`${RULE}.on.target`);
  });
});

describe("the camera when the game loads", () => {
  const fall: GameEffect = { effect: "player-fall" };

  it("names the rule and display of a player effect where the camera is off", () => {
    expect(compilingEffect(fall, { requirement: false })).toThrow(
      `${RULE}.do[0]: player-fall needs a player, but this display doesn't have the camera enabled`,
    );
  });

  it.each([
    ["false", { requirement: false }, true],
    ["set nowhere", {}, true],
    ["enabled", { requirement: "enabled" }, false],
    ["required", { requirement: "required" }, false],
  ] satisfies [string, GameDisplayCameraData, boolean][])("with the display's camera %s", (_, camera, rejected) => {
    const compiling = compilingEffect(fall, camera);
    if (rejected) expect(compiling).toThrow("needs a player");
    else expect(compiling).not.toThrow();
  });

  it.each([
    ["each player-* effect", { effect: "player-restore" }],
    ["a players property", { effect: "stop", players: "all" }],
    ["a player target", { effect: "quake", target: ".player-1" }],
  ] satisfies [string, GameEffect][])("covers %s", (_, effect) => {
    expect(compilingEffect(effect, { requirement: false })).toThrow("needs a player");
  });

  it("covers a reward from a player, but not other rewards or effects", () => {
    const withReward = (extra: object) =>
      gameWith([{ on: { interact: ["click"], target: "#a" }, do: [{ reward: { animation: "stars" }, ...extra }] }], {
        requirement: false,
      });
    expect(() => compileGameRules(withReward({ players: "triggering" }))).toThrow("reward needs a player");
    expect(() => compileGameRules(withReward({ target: ".player" }))).toThrow("reward needs a player");
    expect(() => compileGameRules(withReward({ target: "#b" }))).not.toThrow();
    expect(compilingEffect({ effect: "quake", target: "#b" }, { requirement: false })).not.toThrow();
  });

  it("rejects a rule only the camera could fire, and not one with a pointer interaction too", () => {
    const rule = (interact: GameRule["on"]) => gameWith([{ on: interact, do: [] }], { requirement: false });
    expect(() => compileGameRules(rule({ interact: ["near-enter"], target: "#a", within: 1 }))).toThrow(
      `${RULE}.on: nothing can fire this rule`,
    );
    expect(() => compileGameRules(rule({ interact: "jump" }))).toThrow("nothing can fire this rule");
    expect(() => compileGameRules(rule({ interact: ["hand-enter", "click"], target: "#a" }))).not.toThrow();
    expect(() => compileGameRules(rule({ start: true }))).not.toThrow();
  });

  describe("by inheritance", () => {
    const compiled = (change: (data: GameData) => void) => () => {
      const data = gameWith([{ on: { start: true }, do: [fall] }]);
      delete data.stages[0].challenges[0].displays[0].camera;
      change(data);
      return compileGameRules(data);
    };

    it("defaults to off", () => {
      expect(compiled(() => {})).toThrow("needs a player");
    });

    it("follows the game's module", () => {
      expect(
        compiled((data) => {
          data.modules = { camera: ON_CAMERA };
        }),
      ).not.toThrow();
    });

    it("follows an overview, as it renders behind a stage", () => {
      expect(
        compiled((data) => {
          data.displays[0].camera = ON_CAMERA;
        }),
      ).not.toThrow();
    });

    it("follows the stage's shared display over the overview", () => {
      expect(
        compiled((data) => {
          data.displays[0].camera = ON_CAMERA;
          data.stages[0].displays = [
            { purpose: "shared", camera: { requirement: false }, component: data.displays[0].component },
          ];
        }),
      ).toThrow("needs a player");
    });

    it("lets a display's own setting win", () => {
      expect(
        compiled((data) => {
          data.modules = { camera: ON_CAMERA };
          data.stages[0].challenges[0].displays[0].camera = { requirement: false };
        }),
      ).toThrow("needs a player");
    });

    it("uses a reset display's setting over its parent's, and its parent's when it has none", () => {
      const withReset = (reset: GameDisplayCameraData | undefined, parent: GameDisplayCameraData) => () => {
        const data = gameWith([], parent);
        const [display] = data.stages[0].challenges[0].displays;
        display.resetDisplay = {
          camera: reset,
          component: { ...display.component, rules: [{ on: { start: true }, do: [fall] }] },
        };
        return compileGameRules(data);
      };
      expect(withReset({ requirement: "enabled" }, { requirement: false })).not.toThrow();
      expect(withReset({ requirement: false }, ON_CAMERA)).toThrow(
        `${CHALLENGE_DISPLAY} › resetDisplay › rules[0].do[0]`,
      );
      expect(withReset(undefined, ON_CAMERA)).not.toThrow();
    });

    it("counts a challenge shown alongside that turns the camera on, as that turns it on for all", () => {
      const sideBySide = (challengeChunking: number) => () => {
        const data = gameWith([{ on: { start: true }, do: [fall] }], { requirement: false });
        data.stages[0].challengeChunking = challengeChunking;
        data.stages[0].challenges.push({
          ...challenge("other"),
          displays: [{ ...challenge("other").displays[0], camera: ON_CAMERA }],
        });
        return compileGameRules(data);
      };
      expect(sideBySide(2)).not.toThrow();
      expect(sideBySide(1)).toThrow("needs a player");
    });

    it("counts a challenge turning the camera on for its stage's shared display", () => {
      expect(
        compiled((data) => {
          const shared = { ...data.displays[0].component, rules: [{ on: { start: true as const }, do: [fall] }] };
          data.stages[0].displays = [{ purpose: "shared", component: shared }];
          const [display] = data.stages[0].challenges[0].displays;
          display.component = { ...display.component, rules: [] };
          display.camera = ON_CAMERA;
        }),
      ).not.toThrow();
    });
  });

  it("doesn't fault any game in the local repository", () => {
    for (const data of Object.values((localRepository as unknown as GameRepository).games)) {
      expect(() => compileGameRules(data)).not.toThrow();
    }
  });
});
