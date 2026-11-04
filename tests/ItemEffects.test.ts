import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISPLAY_FRAME_CLASS } from "../src/components/core/effects/EffectTargets";
import {
  ItemEffects,
  coverScale,
  fallDistance,
  highlightKeyframes,
  moveOffsets,
  quakeSteps,
  type EffectRun,
} from "../src/components/core/effects/ItemEffects";

const DISPLAY = { left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500 };

describe("quakeSteps", () => {
  const shape = { dx: 2, dy: 4, cycles: 3, strength: () => 1 };

  it("goes from rest to rest, in order, once there and back per cycle", () => {
    const steps = quakeSteps(shape);
    expect(steps).toHaveLength(1 + 3 * 3);
    expect(steps[0]).toEqual({ offset: 0, x: 0, y: 0 });
    expect(steps.at(-1)).toEqual({ offset: 1, x: 0, y: 0 });
    const offsets = steps.map(({ offset }) => offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("stays within dx and dy, going each way", () => {
    const steps = quakeSteps(shape);
    for (const { x, y } of steps) {
      expect(Math.abs(x)).toBeLessThanOrEqual(2);
      expect(Math.abs(y)).toBeLessThanOrEqual(4);
    }
    expect(steps[1].x).toBeCloseTo(-steps[2].x);
    expect(steps[1].y).toBeCloseTo(-steps[2].y);
  });

  it("reaches the full size when the shake is at its largest", () => {
    const steps = quakeSteps({ ...shape, random: () => 0.999 });
    expect(Math.abs(steps[1].x)).toBeCloseTo(2, 1);
  });

  it("follows the strength through the quake", () => {
    const steps = quakeSteps({ ...shape, strength: (progress) => 1 - progress, random: () => 0.999 });
    const sizes = steps.filter(({ x }) => x !== 0).map(({ x }) => Math.abs(x));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("has no movement at no strength", () => {
    expect(quakeSteps({ ...shape, strength: () => 0 }).every(({ x, y }) => Math.abs(x) + Math.abs(y) === 0)).toBe(true);
  });

  it("moves only the way asked", () => {
    expect(quakeSteps({ ...shape, dy: 0 }).every(({ y }) => y === 0)).toBe(true);
  });
});

describe("coverScale", () => {
  it("leaves an item alone unless it reaches every edge of the display", () => {
    expect(coverScale({ ...DISPLAY, right: 900, width: 900 }, DISPLAY, 1, 1)).toBe(1);
  });

  it("enlarges a full-size item just enough to cover the shake, at its largest need", () => {
    expect(coverScale(DISPLAY, DISPLAY, 1, 0)).toBeCloseTo(1.02);
    expect(coverScale(DISPLAY, DISPLAY, 0, 5)).toBeCloseTo(1.1);
    expect(coverScale(DISPLAY, DISPLAY, 1, 5)).toBeCloseTo(1.1);
  });
});

describe("fallDistance", () => {
  it("takes the item's top past the display's bottom", () => {
    expect(fallDistance(100, DISPLAY)).toBe(80);
    expect(fallDistance(0, DISPLAY)).toBe(100);
  });
});

describe("moveOffsets", () => {
  const measures = {
    visual: { x: 200, y: 100 },
    layout: { x: 100, y: 100 },
    display: DISPLAY,
    centreOf: (selector: string) => (selector === "#platform" ? { x: 500, y: 250 } : undefined),
  };

  it("takes a place in the display as where its centre goes", () => {
    const [, end] = moveOffsets(undefined, { left: 50, top: 20 }, measures);
    expect(end).toEqual({ x: 40, y: 0 }); // 500, 100 on screen is 400 across and 0 down from the layout position
  });

  it("begins where the element appears, part way through an earlier move", () => {
    const [start] = moveOffsets(undefined, { left: 50, top: 20 }, measures);
    expect(start).toEqual({ x: 10, y: 0 });
  });

  it("takes a start", () => {
    const [start] = moveOffsets({ left: 10, top: 40 }, { left: 50, top: 20 }, measures);
    expect(start).toEqual({ x: 0, y: 20 });
  });

  it("takes an amount from where the element appears", () => {
    const [, end] = moveOffsets(undefined, { by: { left: 10, top: -10 } }, measures);
    expect(end).toEqual({ x: 20, y: -10 });
  });

  it("takes an amount from the centre of another element", () => {
    const [, end] = moveOffsets(undefined, { from: "#platform", left: 0, top: -10 }, measures);
    expect(end).toEqual({ x: 40, y: 20 });
  });

  it("uses where the element appears if the other element has gone", () => {
    const [, end] = moveOffsets(undefined, { from: "#gone", left: 0, top: 0 }, measures);
    expect(end).toEqual({ x: 10, y: 0 });
  });
});

describe("highlightKeyframes", () => {
  const own = { filter: "none", boxShadow: "none" };

  it("spaces the steps by their durations, ending at 1", () => {
    const keyframes = highlightKeyframes(
      [
        { filter: "brightness(2)", durationMs: 100 },
        { filter: "brightness(3)", durationMs: 300 },
      ],
      own,
    );
    expect(keyframes.map(({ offset }) => offset)).toEqual([0, 0.25, 1]);
  });

  it("applies a step without an easing at full strength throughout", () => {
    const [first, second] = highlightKeyframes([{ filter: "brightness(2)" }], own);
    expect(first).toMatchObject({ filter: "brightness(2)", easing: "step-end", offset: 0 });
    expect(second).toMatchObject({ filter: "brightness(2)", offset: 1 });
  });

  it("builds a step with an easing from the element's own styles, then from the step before", () => {
    const keyframes = highlightKeyframes(
      [
        { filter: "brightness(2)", easing: "ease-in", durationMs: 500 },
        { filter: "brightness(1)", easing: "ease-out", durationMs: 500 },
      ],
      own,
    );
    expect(keyframes).toEqual([
      { filter: "none", boxShadow: "none", offset: 0, easing: "ease-in" },
      { filter: "brightness(2)", boxShadow: "none", offset: 0.5, easing: "ease-out" },
      { filter: "brightness(1)", boxShadow: "none", offset: 1 },
    ]);
  });

  it("gives a step's other styles the element's own values", () => {
    const keyframes = highlightKeyframes([{ filter: "brightness(2)" }, { shadow: "0 0 1cqw gold" }], own);
    expect(keyframes[1]).toMatchObject({ filter: "none", boxShadow: "0 0 1cqw gold" });
  });
});

describe("ItemEffects", () => {
  /** An animation, as effects use it. */
  const animation = () => ({ onfinish: null as Animation["onfinish"], cancel: vi.fn(), persist: vi.fn() });
  const animations: ReturnType<typeof animation>[] = [];
  const animate = vi.fn<Element["animate"]>(() => {
    const made = Object.assign(new EventTarget(), animation());
    animations.push(made);
    return made as EventTarget & Pick<Animation, "cancel" | "persist" | "onfinish"> as Animation;
  });
  const run = (extra: Partial<EffectRun> = {}): EffectRun => ({
    onEnd: vi.fn(),
    reducedMotion: false,
    find: () => undefined,
    ...extra,
  });
  const element = (className = "") => {
    const made = document.createElement("div");
    made.className = className;
    document.body.append(made);
    return made;
  };
  const translatesOf = (call: number) => (animate.mock.calls[call][0] as Keyframe[]).map((k) => k.translate);
  const optionsOf = (call: number) => animate.mock.calls[call][1] as KeyframeAnimationOptions;

  beforeEach(() => {
    animate.mockClear();
    animations.length = 0;
    Element.prototype.animate = animate;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds to what the element has, so its template's positioning still applies", () => {
    new ItemEffects().fall({ effect: "item-fall" }, [element()], run());
    expect(optionsOf(0).composite).toBe("add");
  });

  it("keeps a fall at its end, against the browser dropping it for a later effect", () => {
    new ItemEffects().fall({ effect: "item-fall", durationMs: 500, easing: "ease-in" }, [element()], run());
    expect(optionsOf(0)).toMatchObject({ duration: 500, easing: "ease-in", fill: "forwards" });
    expect(animations[0].persist).toHaveBeenCalled();
  });

  it("repeats an indefinite fall from its start, with no end to stay at", () => {
    new ItemEffects().fall({ effect: "item-fall", durationMs: "indefinite", cycleMs: 700 }, [element()], run());
    expect(optionsOf(0)).toMatchObject({ duration: 700, iterations: Infinity });
    expect(optionsOf(0).fill).toBeUndefined();
    expect(animations[0].persist).not.toHaveBeenCalled();
  });

  it("restarts an effect fired again, without that counting as an end", () => {
    const effects = new ItemEffects();
    const target = element();
    const onEnd = vi.fn();
    effects.fall({ effect: "item-fall" }, [target], run({ onEnd }));
    const [first] = animations;
    effects.fall({ effect: "item-fall" }, [target], run({ onEnd }));
    expect(first.cancel).toHaveBeenCalled();
    expect(first.onfinish).toBeNull();
    expect(animations).toHaveLength(2);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("runs different effects together", () => {
    const effects = new ItemEffects();
    const target = element();
    effects.fall({ effect: "item-fall" }, [target], run());
    effects.quake({ effect: "quake", dx: 1 }, [target], run());
    expect(animations[0].cancel).not.toHaveBeenCalled();
    expect(animations).toHaveLength(2);
  });

  it("reports an effect ending, for each element", () => {
    const onEnd = vi.fn();
    const [a, b] = [element(), element()];
    new ItemEffects().fall({ effect: "item-fall" }, [a, b], run({ onEnd }));
    const finished = animations[1].onfinish as ((event: AnimationPlaybackEvent) => void) | null;
    finished?.(new Event("finish") as AnimationPlaybackEvent);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(b);
  });

  describe("highlight", () => {
    const sequence = [
      { filter: "brightness(2)", durationMs: 100 },
      { filter: "brightness(1)", durationMs: 300 },
    ];

    it("plays once by default, returning to the element's own styles", () => {
      new ItemEffects().highlight({ effect: "highlight", sequence }, [element()], run());
      expect(optionsOf(0)).toMatchObject({ duration: 400, iterations: 1, composite: "replace" });
      expect(optionsOf(0).fill).toBeUndefined();
    });

    it("repeats for a number's length, or until stopped", () => {
      new ItemEffects().highlight({ effect: "highlight", sequence, durationMs: 1000 }, [element()], run());
      expect(optionsOf(0).iterations).toBe(2.5);
      new ItemEffects().highlight({ effect: "highlight", sequence, durationMs: "indefinite" }, [element()], run());
      expect(optionsOf(1).iterations).toBe(Infinity);
    });

    it("does nothing with a sequence of no length", () => {
      new ItemEffects().highlight({ effect: "highlight", sequence: [{ durationMs: 0 }] }, [element()], run());
      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    const fallAndQuake = (effects: ItemEffects, target: Element) => {
      effects.fall({ effect: "item-fall" }, [target], run());
      effects.quake({ effect: "quake", dx: 1 }, [target], run());
    };

    it("ends only the effect it names, without that counting as an end", () => {
      const effects = new ItemEffects();
      const target = element();
      fallAndQuake(effects, target);
      effects.stop([target], "quake");
      expect(animations[0].cancel).not.toHaveBeenCalled();
      expect(animations[1].cancel).toHaveBeenCalled();
      expect(animations[1].onfinish).toBeNull();
    });

    it("ends everything on the element without a name", () => {
      const effects = new ItemEffects();
      const target = element();
      fallAndQuake(effects, target);
      effects.stop([target], undefined);
      expect(animations[0].cancel).toHaveBeenCalled();
      expect(animations[1].cancel).toHaveBeenCalled();
    });

    it("does nothing to an element not running it", () => {
      expect(() => new ItemEffects().stop([element()], "quake")).not.toThrow();
    });
  });

  describe("for players who prefer reduced motion", () => {
    const reduced = (onEnd = vi.fn()) => run({ reducedMotion: true, onEnd });

    it("doesn't play a quake, and still counts it as ending", () => {
      const onEnd = vi.fn();
      new ItemEffects().quake({ effect: "quake", dx: 1 }, [element()], reduced(onEnd));
      expect(animate).not.toHaveBeenCalled();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("jumps a fall to its end, even an indefinite one", () => {
      new ItemEffects().fall({ effect: "item-fall", durationMs: "indefinite" }, [element()], reduced());
      expect(optionsOf(0)).toMatchObject({ duration: 0, fill: "forwards" });
      expect(optionsOf(0).iterations).toBeUndefined();
    });

    it("jumps a move to its end", () => {
      new ItemEffects().move({ effect: "item-move", end: { left: 0, top: 0 } }, [element()], reduced());
      expect(optionsOf(0)).toMatchObject({ duration: 0, fill: "forwards" });
    });
  });

  describe("quake", () => {
    const quakeOf = (consistentMotion: boolean, elements: Element[]) =>
      new ItemEffects().quake({ effect: "quake", dx: 5, dy: 5, durationMs: 300, consistentMotion }, elements, run());

    it("gives each element the same motion by default", () => {
      quakeOf(true, [element(), element()]);
      expect(translatesOf(0)).toEqual(translatesOf(1));
    });

    it("gives each element its own motion when asked", () => {
      quakeOf(false, [element(), element()]);
      expect(translatesOf(0)).not.toEqual(translatesOf(1));
    });

    it("keeps a dialog's frames together regardless", () => {
      quakeOf(false, [element(DISPLAY_FRAME_CLASS), element(DISPLAY_FRAME_CLASS)]);
      expect(translatesOf(0)).toEqual(translatesOf(1));
    });

    it("loops one cycle when indefinite", () => {
      new ItemEffects().quake({ effect: "quake", dx: 5, durationMs: "indefinite", cycleMs: 80 }, [element()], run());
      expect(optionsOf(0)).toMatchObject({ duration: 80, iterations: Infinity });
      expect(translatesOf(0)).toHaveLength(4);
    });

    it("has no end to stay at", () => {
      new ItemEffects().quake({ effect: "quake", dx: 5 }, [element()], run());
      expect(optionsOf(0).fill).toBeUndefined();
    });
  });
});
