import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DIALOG_CONTAINER_CLASS,
  DISPLAY_FRAME_CLASS,
  centreOnScreen,
  displayDistance,
  displayRect,
  resolveTargets,
  warnIfTrappingDepth,
} from "../src/components/core/effects/EffectTargets";

const A = "challenge:s:a:challenge-in-progress";
const B = "challenge:s:b:challenge-in-progress";

/** A foreground layer holding a template for each display, each with the same ids. */
const page = (html = '<div id="door" class="item"></div><p class="item"></p>') => {
  document.body.innerHTML = `
    <div id="stage" class="display-background">
      <div data-display-scope="${A}"><div class="templateBody"><div id="sky"></div></div></div>
    </div>
    <div id="challenges" class="display-foreground">
      <div data-display-scope="${A}"><div class="templateBody">${html}</div></div>
      <div data-display-scope="${B}"><div class="templateBody">${html}</div></div>
    </div>
    <div class="playerWrapper player player-1" id="p1"></div>
    <div id="outside"></div>`;
};
const roots = (scope: string) => Array.from(document.querySelectorAll(`[data-display-scope="${scope}"]`));
const ids = (elements: Element[]) => elements.map((element) => element.id || element.tagName);

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("resolveTargets", () => {
  it("looks only inside the display whose rule fired, so another challenge's same ids aren't reached", () => {
    page();
    const [door] = resolveTargets(A, "#door", [A, B]);
    expect(roots(A)[1].contains(door)).toBe(true);
    expect(resolveTargets(A, "#door", [A, B])).toHaveLength(1);
  });

  it("finds players, which are outside any display", () => {
    page();
    expect(ids(resolveTargets(A, ".player-1", [A]))).toEqual(["p1"]);
    expect(ids(resolveTargets(A, ".player", [A]))).toEqual(["p1"]);
  });

  it("doesn't reach other elements outside the display", () => {
    page();
    expect(resolveTargets(A, "#outside", [A])).toEqual([]);
  });

  it("gives the items inside a layer's containers, not the containers", () => {
    page();
    expect(ids(resolveTargets(A, ".display-background", [A]))).toEqual(["sky"]);
    expect(ids(resolveTargets(A, ".display-foreground", [A]))).toEqual(["door", "P", "door", "P"]);
  });

  it("without a target, gives each top-level item in the shown displays' templates", () => {
    page();
    expect(ids(resolveTargets(A, undefined, [A, B]))).toEqual(["sky", "door", "P", "door", "P"]);
    expect(ids(resolveTargets(A, undefined, [B]))).toEqual(["door", "P"]);
  });

  it("gives the children of a wrapper holding depth items, recursively, so they can still sort", () => {
    page('<div id="wrapper"><div id="inner"><div id="post" data-depth="40"></div><p id="sign"></p></div></div>');
    expect(ids(resolveTargets(A, undefined, [B]))).toEqual(["post", "sign"]);
  });

  it("gives a dialog's frame, not its text", () => {
    document.body.innerHTML = `
      <div class="${DISPLAY_FRAME_CLASS}" id="frame"><div data-display-scope="${A}">
        <div class="templateBody"><p>text</p></div>
      </div></div>`;
    expect(ids(resolveTargets(A, undefined, [A]))).toEqual(["frame"]);
  });

  it("gives each element once", () => {
    page();
    expect(resolveTargets(A, "#p1, .player", [A])).toHaveLength(1);
  });
});

describe("warnIfTrappingDepth", () => {
  it("warns about a chosen wrapper holding depth items, and not about anything else", () => {
    page('<div id="wrapper"><div data-depth="40"></div></div>');
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [wrapper] = roots(B)[0].querySelectorAll("#wrapper");
    warnIfTrappingDepth([wrapper], undefined, "rule");
    warnIfTrappingDepth([document.body.querySelector("#p1")!], "#p1", "rule");
    expect(warn).not.toHaveBeenCalled();
    warnIfTrappingDepth([wrapper], "#wrapper", "rule");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rule: "#wrapper" holds data-depth items'));
  });
});

describe("display measures", () => {
  const stub = (element: Element, rect: DOMRect) => vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);

  /** An element in a 1000 by 500 display, optionally inside a 500 by 500 dialog. */
  const inDisplay = (inDialog: boolean) => {
    document.body.innerHTML = `
      <div class="gameViewport"><div class="${inDialog ? DIALOG_CONTAINER_CLASS : ""}"><div id="item"></div></div></div>`;
    stub(document.querySelector(".gameViewport")!, new DOMRect(0, 0, 1000, 500));
    stub(document.querySelector("#item")!.parentElement!, new DOMRect(0, 0, 500, 500));
    return document.querySelector("#item")!;
  };

  it("measures a distance in the display's units", () => {
    expect(displayDistance(inDisplay(false), { x: 10, y: -5 })).toBe("10cqw -5cqh");
  });

  it("scales the units inside a dialog, as they measure the dialog there", () => {
    expect(displayDistance(inDisplay(true), { x: 10, y: -5 })).toBe("20cqw -5cqh");
  });

  it("finds the display around an element", () => {
    expect(displayRect(inDisplay(false)).width).toBe(1000);
  });

  it("finds an element's centre", () => {
    const item = inDisplay(false);
    stub(item, new DOMRect(10, 20, 100, 40));
    expect(centreOnScreen(item)).toEqual({ x: 60, y: 40 });
  });
});
