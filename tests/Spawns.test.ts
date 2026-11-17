import { afterEach, describe, expect, it, vi } from "vitest";
import { despawn, MAX_SPAWNED, spawn, SPAWNED_ATTRIBUTE } from "../src/components/core/effects/Spawns";

const SCOPE = "challenge:s1:c1:challenge-in-progress";
const AT = { run: 1, where: "rule" };

/** A scene's template container holding the given markup. */
const sceneWith = (html: string) => {
  const root = document.createElement("div");
  root.dataset.sceneScope = SCOPE;
  root.innerHTML = html;
  document.body.append(root);
  return root;
};

const LANE = '<div id="lane"><p id="still">here before</p></div>';

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("spawn", () => {
  it("adds a copy of the template's element at the end of into, marked and with an id of its own", () => {
    const root = sceneWith(`${LANE}<template id="ball"><i class="ball"><b></b></i></template>`);
    const first = spawn(SCOPE, { spawn: "#ball", into: "#lane" }, AT)!;
    const second = spawn(SCOPE, { spawn: "#ball", into: "#lane" }, AT)!;
    expect(Array.from(root.querySelector("#lane")!.children)).toEqual([root.querySelector("#still"), first, second]);
    expect(first.matches(`i.ball[${SPAWNED_ATTRIBUTE}]`)).toBe(true);
    expect(first.querySelector("b")).not.toBeNull();
    expect(first.id).toMatch(/^ball-\d+$/);
    expect(second.id).not.toBe(first.id);
  });

  it("keeps an id the markup gives", () => {
    sceneWith(`${LANE}<template id="t"><i id="mine"></i></template>`);
    expect(spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT)?.id).toBe("mine");
  });

  it.each([
    ["no <template>", { spawn: "#lane", into: "#lane" }, 'rule.spawn: "#lane" matches no <template>'],
    ["no into", { spawn: "#t", into: "#nowhere" }, 'rule.into: "#nowhere" matches nothing'],
  ])("warns and spawns nothing for %s", (_, action, message) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sceneWith(`${LANE}<template id="t"><i></i></template>`);
    expect(spawn(SCOPE, action, AT)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(message));
  });

  it("warns that only the first of several elements spawns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sceneWith(`${LANE}<template id="t"><i class="a"></i><i class="b"></i></template>`);
    expect(spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT)?.className).toBe("a");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("only the first spawns"));
  });

  it(`stops at ${MAX_SPAWNED} copies in a scene, logging once a run`, () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = sceneWith(`${LANE}<template id="t"><i></i></template>`);
    for (let i = 0; i < MAX_SPAWNED + 5; i++) spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT);
    expect(root.querySelectorAll(`[${SPAWNED_ATTRIBUTE}]`)).toHaveLength(MAX_SPAWNED);
    expect(error).toHaveBeenCalledOnce();
    despawn(SCOPE, "i");
    expect(spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT)).toBeDefined();
  });
});

describe("despawn", () => {
  it("removes the copies a selector matches, and leaves elements that weren't spawned", () => {
    const root = sceneWith(`${LANE}<template id="t"><p class="x"></p></template><p class="x" id="authored"></p>`);
    const copy = spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT)!;
    const other = spawn(SCOPE, { spawn: "#t", into: "#lane" }, AT)!;
    despawn(SCOPE, `[id="${copy.id}"]`);
    expect(copy.isConnected).toBe(false);
    expect(other.isConnected).toBe(true);
    despawn(SCOPE, ".x");
    expect(other.isConnected).toBe(false);
    expect(root.querySelector("#authored")).not.toBeNull();
  });
});
