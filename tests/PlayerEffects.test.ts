import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRegistry } from "../src/components/camera/PlayerRegistry";
import { sceneEnds } from "../src/components/core/effects/GameEffectsHook";
import { ItemEffects } from "../src/components/core/effects/ItemEffects";
import {
  PlayerEffects,
  offscreenDistance,
  silhouetteTop,
  type PlayerEffectRun,
} from "../src/components/core/effects/PlayerEffects";
import { NO_EVENT } from "../src/components/core/logic/GameRuleUtils";
import type { GameEffect } from "../src/entities/data/scenes/GameEffectData";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 100;
const HEIGHT = 100;

describe("offscreenDistance", () => {
  const scene = { width: 1000, height: 500 };

  it("goes straight up to the top edge, plus its reach", () => {
    expect(offscreenDistance({ x: 500, y: 200 }, 50, 0, scene)).toBeCloseTo(250);
  });

  it("goes right and left to those edges", () => {
    expect(offscreenDistance({ x: 500, y: 250 }, 50, 90, scene)).toBeCloseTo(550);
    expect(offscreenDistance({ x: 100, y: 250 }, 50, -90, scene)).toBeCloseTo(150);
  });

  it("goes further on a diagonal, as it nears an edge more slowly", () => {
    expect(offscreenDistance({ x: 500, y: 250 }, 0, 60, scene)).toBeCloseTo(500);
  });

  it("allows for a larger reach, as a zoomed player must have fully left", () => {
    const small = offscreenDistance({ x: 500, y: 250 }, 50, 0, scene);
    const large = offscreenDistance({ x: 500, y: 250 }, 500, 0, scene);
    expect(large - small).toBeCloseTo(450);
  });
});

describe("silhouetteTop", () => {
  it("finds the first row with any of the silhouette", () => {
    const mask = new Uint8Array(100);
    mask[35] = 1;
    mask[75] = 1;
    expect(silhouetteTop(mask, 10, 10)).toBe(0.3);
  });

  it("counts an empty one as already off the bottom", () => {
    expect(silhouetteTop(new Uint8Array(100), 10, 10)).toBe(1);
  });
});

describe("sceneEnds", () => {
  const shown = (...entries: [string, string, number][]) =>
    new Map(entries.map(([place, scope, run]) => [place, { scope, run }]));

  it("sees nothing while what shows stays the same", () => {
    const now = shown(["a", "a", 1]);
    expect(sceneEnds(now, shown(["a", "a", 1]))).toEqual({ moved: false, reset: [] });
  });

  it("sees a move when a scene is replaced", () => {
    expect(sceneEnds(shown(["a", "a", 1]), shown(["b", "b", 1])).moved).toBe(true);
    expect(sceneEnds(shown(["a", "a", 1]), shown(["a", "a", 1], ["b", "b", 1])).moved).toBe(true);
  });

  it("sees a reset when a scene starts a new run", () => {
    expect(sceneEnds(shown(["a", "a", 1], ["b", "b", 1]), shown(["a", "a", 2], ["b", "b", 1]))).toEqual({
      moved: false,
      reset: ["a"],
    });
  });

  it("sees a reset, not a move, when a scene and its reset scene take turns", () => {
    expect(sceneEnds(shown(["a", "a", 1]), shown(["a", "a/reset", 1]))).toEqual({ moved: false, reset: ["a"] });
    expect(sceneEnds(shown(["a", "a/reset", 1]), shown(["a", "a", 2]))).toEqual({ moved: false, reset: ["a"] });
  });
});

describe("PlayerEffects", () => {
  /** An animation, as effects use it. */
  const animation = () => ({
    onfinish: null as Animation["onfinish"],
    cancel: vi.fn(),
    persist: vi.fn(),
    finish: vi.fn(),
  });
  const animations: ReturnType<typeof animation>[] = [];
  const animate = vi.fn<Element["animate"]>(() => {
    const made = Object.assign(new EventTarget(), animation());
    animations.push(made);
    return made as EventTarget & Pick<Animation, "cancel" | "persist" | "onfinish" | "finish"> as Animation;
  });
  const finishLast = () => {
    const finished = animations.at(-1)?.onfinish as ((event: AnimationPlaybackEvent) => void) | null | undefined;
    finished?.(new Event("finish") as AnimationPlaybackEvent);
  };
  const keyframesOf = (call: number) => animate.mock.calls[call][0] as Keyframe[];
  const optionsOf = (call: number) => animate.mock.calls[call][1] as KeyframeAnimationOptions;

  /** Someone whose silhouette is a block from row 40 to 60, across columns 20 to 40. */
  const body = (id: number): VisionPerson => {
    const mask = new Uint8Array(WIDTH * HEIGHT);
    for (let y = 40; y < 60; y++) for (let x = 20; x < 40; x++) mask[y * WIDTH + x] = 1;
    return { id, mask, keyPoints: noKeyPoints(), scale: 1 };
  };
  const frame = (...people: VisionPerson[]): VisionFrame => ({ width: WIDTH, height: HEIGHT, timestamp: 0, people });

  /** Players in a registry, each with a wrapper on the page, in a scene 1000 by 1000. */
  const withPlayers = (count: number, mirrored = false) => {
    const players = new PlayerRegistry();
    const people = Array.from({ length: count }, (_, index) => body(index + 10));
    const ids = players.update(frame(...people)).interactive.people.map(({ id }) => id);
    for (const id of ids) {
      const number = players.numberOf(id)!;
      const wrapper = document.createElement("div");
      wrapper.className = `player player-${number}`;
      wrapper.dataset.player = String(number);
      const canvas = document.createElement("canvas");
      if (mirrored) canvas.style.transform = "scaleX(-1)";
      wrapper.append(canvas);
      document.body.append(wrapper);
      vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 1000));
    }
    return { players, ids, effects: new PlayerEffects(new ItemEffects(), players) };
  };
  const wrapperOf = (number: number) => document.querySelector<HTMLElement>(`.player-${number}`)!;
  const run = (extra: Partial<PlayerEffectRun> = {}): PlayerEffectRun => ({
    scope: "scope",
    event: { ...NO_EVENT, player: 1 },
    where: "rule",
    reducedMotion: false,
    find: () => undefined,
    onEnd: vi.fn(),
    ...extra,
  });
  const fall: GameEffect = { effect: "player-fall", durationMs: 700, easing: "ease-in" };

  beforeEach(() => {
    animate.mockClear();
    animations.length = 0;
    Element.prototype.animate = animate;
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("choosing players", () => {
    it("applies to whoever fired the rule by default", () => {
      const { players, ids, effects } = withPlayers(2);
      effects.play(fall, run({ event: { ...NO_EVENT, player: 2 } }));
      expect(players.stateOf(ids[0])).toBe("active");
      expect(players.stateOf(ids[1])).toBe("leaving");
    });

    it("does nothing and warns on a rule no player fired", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run({ event: NO_EVENT }));
      expect(players.stateOf(ids[0])).toBe("active");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("rule: no player fired this rule"));
    });

    it("applies to everyone with all", () => {
      const { players, ids, effects } = withPlayers(2);
      effects.play({ ...fall, players: "all" }, run({ event: NO_EVENT }));
      expect(ids.map((id) => players.stateOf(id))).toEqual(["leaving", "leaving"]);
    });

    it("does nothing with nobody there", () => {
      const { effects } = withPlayers(0);
      expect(() => effects.play({ effect: "player-fall", players: "all" }, run())).not.toThrow();
    });
  });

  describe("player-fall", () => {
    it("moves their wrapper by enough to take the top of them off the scene", () => {
      const { effects } = withPlayers(1);
      effects.play(fall, run());
      expect(keyframesOf(0)).toEqual([{ translate: "0 0" }, { translate: "0 60%" }]);
      expect(optionsOf(0)).toMatchObject({ duration: 700, easing: "ease-in", fill: "forwards", composite: "add" });
    });

    it("removes them as it ends, before rules hear of it", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn(() => expect(players.stateOf(ids[0])).toBe("removed"));
      effects.play(fall, run({ onEnd }));
      expect(players.stateOf(ids[0])).toBe("leaving");
      finishLast();
      expect(onEnd).toHaveBeenCalledExactlyOnceWith(wrapperOf(1));
    });

    it("ignores another on a leaving or removed player", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      effects.play(fall, run());
      expect(animate).toHaveBeenCalledTimes(1);
      finishLast();
      effects.play(fall, run());
      expect(animate).toHaveBeenCalledTimes(1);
      expect(players.stateOf(ids[0])).toBe("removed");
    });

    it("jumps to its end for players who prefer reduced motion, with the same state", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run({ reducedMotion: true }));
      expect(optionsOf(0)).toMatchObject({ duration: 0, fill: "forwards" });
      finishLast();
      expect(players.stateOf(ids[0])).toBe("removed");
    });

    it("starts falling from frozen, which stops counting them as frozen", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-freeze" }, run());
      effects.play(fall, run());
      expect(players.stateOf(ids[0])).toBe("leaving");
    });
  });

  describe("player-spin-away", () => {
    const spin: GameEffect = {
      effect: "player-spin-away",
      angle: { min: 0, max: 0 },
      zoom: 0.5,
      opacity: 0,
      rotations: 1,
    };

    it("turns about the centre of their body, not their canvas", () => {
      const { effects } = withPlayers(1);
      effects.play(spin, run());
      expect(wrapperOf(1).style.transformOrigin).toBe("295px 495px");
    });

    it("flips that centre for a mirrored camera", () => {
      const { effects } = withPlayers(1, true);
      effects.play(spin, run());
      const [across, down] = wrapperOf(1).style.transformOrigin.split(" ").map(Number.parseFloat);
      expect(across).toBeCloseTo(705);
      expect(down).toBeCloseTo(495);
    });

    it("zooms, fades, turns and leaves in the direction chosen, setting them outright", () => {
      const { effects } = withPlayers(1);
      effects.play(spin, run());
      const [start, end] = keyframesOf(0);
      expect(start).toMatchObject({ scale: "1", opacity: 1 });
      expect(end).toMatchObject({ scale: "0.5", opacity: 0 });
      expect(Math.abs(Number.parseFloat(String(end.rotate)))).toBe(360);
      const [across, down] = String(end.translate).split(" ").map(Number.parseFloat);
      expect(across).toBeCloseTo(0);
      expect(down).toBeLessThan(-495); // up, beyond the top edge
      expect(optionsOf(0).composite).toBe("replace");
    });

    it("picks a direction within its angle", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.75);
      const { effects } = withPlayers(1);
      effects.play({ ...spin, angle: { min: 0, max: 90 } }, run());
      const [across, down] = String(keyframesOf(0)[1].translate).split(" ").map(Number.parseFloat);
      expect(across).toBeGreaterThan(0);
      expect(Math.atan2(across, -down) * (180 / Math.PI)).toBeCloseTo(67.5);
    });

    it("removes them as it ends", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(spin, run());
      finishLast();
      expect(players.stateOf(ids[0])).toBe("removed");
    });
  });

  describe("player-invisible and player-visible", () => {
    it("fades their wrapper, leaving them active", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-invisible", durationMs: 500 }, run());
      expect(keyframesOf(0).at(-1)).toMatchObject({ opacity: 0 });
      expect(optionsOf(0)).toMatchObject({ duration: 500, fill: "forwards", composite: "replace" });
      expect(players.stateOf(ids[0])).toBe("active");
      effects.play({ effect: "player-visible" }, run());
      expect(keyframesOf(1).at(-1)).toMatchObject({ opacity: 1 });
      expect(animations[0].cancel).toHaveBeenCalled();
    });
  });

  describe("player-freeze and player-unfreeze", () => {
    it("apply at once, and report their end", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play({ effect: "player-freeze" }, run({ onEnd }));
      expect(players.stateOf(ids[0])).toBe("frozen");
      expect(onEnd).toHaveBeenCalledTimes(1);
      effects.play({ effect: "player-unfreeze" }, run({ onEnd }));
      expect(players.stateOf(ids[0])).toBe("active");
      expect(onEnd).toHaveBeenCalledTimes(2);
    });

    it("unfreezing does nothing to a player who is leaving or removed", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      effects.play({ effect: "player-unfreeze" }, run());
      expect(players.stateOf(ids[0])).toBe("leaving");
    });
  });

  describe("player-restore", () => {
    const restore: GameEffect = { effect: "player-restore", players: "all", durationMs: 300 };

    it("returns a removed player, and fades them in", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      finishLast();
      const [falling] = animations;
      effects.play(restore, run({ event: NO_EVENT }));
      expect(players.stateOf(ids[0])).toBe("active");
      expect(falling.cancel).toHaveBeenCalled();
      expect(keyframesOf(1)).toEqual([{ opacity: 0 }, { opacity: 1 }]);
      expect(optionsOf(1).duration).toBe(300);
    });

    it("returns a leaving player without them being removed or rules hearing they left", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play(fall, run({ onEnd }));
      const [falling] = animations;
      effects.play(restore, run({ event: NO_EVENT }));
      expect(players.stateOf(ids[0])).toBe("active");
      expect(falling.onfinish).toBeNull();
    });

    it("returns a frozen and an invisible player", () => {
      const { players, ids, effects } = withPlayers(2);
      effects.play({ effect: "player-freeze" }, run());
      effects.play({ effect: "player-invisible", durationMs: 100 }, run({ event: { ...NO_EVENT, player: 2 } }));
      const [fading] = animations;
      effects.play(restore, run({ event: NO_EVENT }));
      expect(ids.map((id) => players.stateOf(id))).toEqual(["active", "active"]);
      expect(fading.cancel).toHaveBeenCalled();
    });

    it("clears the turning origin", () => {
      const { effects } = withPlayers(1);
      effects.play({ effect: "player-spin-away" }, run());
      effects.play(restore, run({ event: NO_EVENT }));
      expect(wrapperOf(1).style.transformOrigin).toBe("");
    });

    it("doesn't fade in someone nothing had happened to", () => {
      const { effects } = withPlayers(1);
      effects.play(restore, run({ event: NO_EVENT }));
      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("as their scene ends", () => {
    it("restores them, however they were", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      effects.end(ids[0], false);
      expect(players.stateOf(ids[0])).toBe("active");
    });

    it("keeps a removed player when asked", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      finishLast();
      effects.end(ids[0], true);
      expect(players.stateOf(ids[0])).toBe("removed");
    });

    it("sends one on the way straight to removed, when keeping them", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play(fall, run());
      effects.end(ids[0], true);
      expect(players.stateOf(ids[0])).toBe("removed");
      expect(animations[0].finish).toHaveBeenCalled();
    });

    it("restores a frozen player even when keeping removed ones", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-freeze" }, run());
      effects.end(ids[0], true);
      expect(players.stateOf(ids[0])).toBe("active");
    });
  });

  describe("stop", () => {
    it("ends what is running on the chosen players, except what they must finish", () => {
      const { effects } = withPlayers(1);
      effects.play({ effect: "player-invisible", durationMs: 100 }, run());
      effects.play({ effect: "stop", players: "triggering", stop: "player-opacity" }, run());
      expect(animations[0].cancel).toHaveBeenCalled();
    });

    it("leaves what it doesn't name", () => {
      const { effects } = withPlayers(1);
      effects.play({ effect: "player-invisible", durationMs: 100 }, run());
      effects.play({ effect: "stop", players: "triggering", stop: "player-static" }, run());
      expect(animations[0].cancel).not.toHaveBeenCalled();
    });
  });

  describe("player-static", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const look = (players: PlayerRegistry, id: number) => players.staticOf(id)?.lookAt(performance.now());

    it("eases in, holds, and eases out when stopped, leaving the player active", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-static", proportion: 0.6, easeMs: 100, pixelSize: 2 }, run());
      expect(players.stateOf(ids[0])).toBe("active");
      vi.advanceTimersByTime(50);
      expect(look(players, ids[0])?.proportion).toBeCloseTo(0.3);
      vi.advanceTimersByTime(1000);
      expect(look(players, ids[0])).toEqual({ pixelSize: 2, proportion: 0.6, still: false });

      effects.play({ effect: "stop", players: "triggering", stop: "player-static" }, run());
      vi.advanceTimersByTime(50);
      expect(look(players, ids[0])?.proportion).toBeCloseTo(0.3);
      vi.advanceTimersByTime(50);
      expect(players.staticOf(ids[0])).toBeUndefined();
    });

    it("includes its easing in a set duration, then ends and says so", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play({ effect: "player-static", durationMs: 1000, easeMs: 100, proportion: 1 }, run({ onEnd }));
      vi.advanceTimersByTime(950);
      expect(look(players, ids[0])?.proportion).toBeCloseTo(0.5);
      expect(onEnd).not.toHaveBeenCalled();
      vi.advanceTimersByTime(50);
      expect(players.staticOf(ids[0])).toBeUndefined();
      expect(onEnd).toHaveBeenCalledExactlyOnceWith(wrapperOf(1));
    });

    it("doesn't say it ended when stopped early", () => {
      const { effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play({ effect: "player-static", durationMs: 1000, easeMs: 100 }, run({ onEnd }));
      effects.play({ effect: "stop", players: "triggering" }, run());
      vi.advanceTimersByTime(5000);
      expect(onEnd).not.toHaveBeenCalled();
    });

    it("restarts when fired again, without the first one's end counting", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play({ effect: "player-static", durationMs: 1000, easeMs: 100 }, run({ onEnd }));
      vi.advanceTimersByTime(500);
      effects.play({ effect: "player-static", durationMs: 1000, easeMs: 100 }, run({ onEnd }));
      vi.advanceTimersByTime(500);
      expect(players.staticOf(ids[0])).toBeDefined();
      expect(onEnd).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("holds still for players who prefer reduced motion", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-static" }, run({ reducedMotion: true }));
      expect(look(players, ids[0])?.still).toBe(true);
    });

    it("clears at once on a restore, and as their scene ends, without saying it ended", () => {
      const { players, ids, effects } = withPlayers(1);
      const onEnd = vi.fn();
      effects.play({ effect: "player-static", durationMs: 1000 }, run({ onEnd }));
      effects.end(ids[0], false);
      expect(players.staticOf(ids[0])).toBeUndefined();
      vi.advanceTimersByTime(5000);
      expect(onEnd).not.toHaveBeenCalled();
    });

    it("notes the scene that started it, so it ends with that scene", () => {
      const { players, ids, effects } = withPlayers(1);
      effects.play({ effect: "player-static" }, run({ scope: "scene-a" }));
      expect(players.setByOf(ids[0])).toBe("scene-a");
    });
  });

  describe("bodyCentre", () => {
    it("finds the middle of their body on screen", () => {
      const { effects } = withPlayers(1);
      expect(effects.bodyCentre(wrapperOf(1))).toEqual({ x: 295, y: 495 });
    });

    it("flips it for a mirrored camera", () => {
      const { effects } = withPlayers(1, true);
      const { x, y } = effects.bodyCentre(wrapperOf(1));
      expect(x).toBeCloseTo(705);
      expect(y).toBeCloseTo(495);
    });
  });
});
