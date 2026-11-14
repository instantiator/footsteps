import { describe, expect, it } from "vitest";
import { cropPlacement, DEFAULT_CORNERS, floorCrop, viewportToFloor } from "../src/components/camera/FloorGeometry";
import { Idiomorph } from "idiomorph";
import {
  floorRegionOf,
  isInRegion,
  isUnreachable,
  keepPlacement,
  parseFloorItem,
} from "../src/components/core/layout/FloorPlacement";
import type { Point } from "../src/vision/VisionTypes";

/** An element with the given attributes. */
const element = (attributes: Record<string, string>): Element => {
  const item = document.createElement("div");
  Object.entries(attributes).forEach(([name, value]) => item.setAttribute(name, value));
  return item;
};

describe("parseFloorItem", () => {
  it("needs a floor y, and defaults the rest", () => {
    expect(parseFloorItem(element({ "data-floor-y": "80" }))).toEqual({
      y: 80,
      x: undefined,
      height: 0,
      anchor: "center bottom",
      thickness: undefined,
    });
  });

  it("reads every attribute, keeping values off the floor as given", () => {
    const item = element({
      "data-floor-y": "-10",
      "data-floor-x": "120",
      "data-floor-height": "15",
      "data-floor-anchor": "40% 70%",
      "data-floor-thickness": "20",
    });
    expect(parseFloorItem(item)).toEqual({ y: -10, x: 120, height: 15, anchor: "40% 70%", thickness: 20 });
  });

  it.each(["", " ", "near", "Infinity", "1; z-index: 9"])("isn't on the floor with a floor y of %j", (value) => {
    expect(parseFloorItem(element({ "data-floor-y": value }))).toBeNull();
  });

  it("isn't on the floor without a floor y, whatever else it has", () => {
    expect(parseFloorItem(element({ "data-floor-x": "50" }))).toBeNull();
  });

  it("ignores bad optional values", () => {
    const item = element({
      "data-floor-y": "50",
      "data-floor-x": "left",
      "data-floor-height": "tall",
      "data-floor-anchor": " ",
    });
    expect(parseFloorItem(item)).toMatchObject({ x: undefined, height: 0, anchor: "center bottom" });
  });
});

describe("floorRegionOf", () => {
  const band = { left: -Infinity, back: 50, right: Infinity, front: 70 };

  it("is the band of floor y centred on a thick item, from the item or anything inside it", () => {
    const item = element({ "data-floor-y": "60", "data-floor-thickness": "20" });
    const inside = item.appendChild(document.createElement("span"));
    expect(floorRegionOf(item)).toEqual(band);
    expect(floorRegionOf(inside)).toEqual(band);
  });

  it("is a floor area's rectangle, from the area or anything inside it", () => {
    const area = element({ "data-floor-area": "10 20 30 40" });
    const inside = area.appendChild(document.createElement("span"));
    expect(floorRegionOf(inside)).toEqual({ left: 10, back: 20, right: 30, front: 40 });
    expect(floorRegionOf(element({ "data-floor-area": "10 20" }))).toBeUndefined();
  });

  it("is nothing for an item with no thickness, or anything off the floor", () => {
    expect(floorRegionOf(element({ "data-floor-y": "60" }))).toBeUndefined();
    expect(floorRegionOf(element({ "data-floor-thickness": "20" }))).toBeUndefined();
  });

  it("holds a point inside its edges, and not one just past them", () => {
    const area = { left: 10, back: 20, right: 30, front: 40 };
    expect(isInRegion({ x: 10, y: 40 }, area)).toBe(true);
    expect(isInRegion({ x: 9.9, y: 30 }, area)).toBe(false);
    expect(isInRegion({ x: 500, y: 60 }, band)).toBe(true);
  });
});

describe("isUnreachable", () => {
  const view = { corners: DEFAULT_CORNERS, crop: cropPlacement(floorCrop(DEFAULT_CORNERS), false), mirrored: false };
  const toFloor = (point: Point) => viewportToFloor(view, point);

  it("is true for a rectangle in a back corner, beside the narrowing floor", () => {
    expect(isUnreachable({ left: 0, top: 0.62, right: 0.1, bottom: 0.7 }, toFloor)).toBe(true);
  });

  it("is false for a rectangle on the floor, or straddling its edge", () => {
    expect(isUnreachable({ left: 0.4, top: 0.8, right: 0.6, bottom: 0.9 }, toFloor)).toBe(false);
    expect(isUnreachable({ left: 0, top: 0.62, right: 0.3, bottom: 0.7 }, toFloor)).toBe(false);
  });
});

describe("keepPlacement", () => {
  it("keeps floor items and surfaces where placement put them through a re-render, and nothing else", () => {
    const body = document.createElement("div");
    body.innerHTML = `<div id="post" data-floor-y="50" style="color: red; translate: 10px 20px; scale: 0.5"></div>
      <div id="tile" data-floor-area="0 0 50 50" style="transform: matrix(1, 0, 0, 1, 5, 5)"></div>
      <div id="wall" class="rear-wall" style="z-index: -3"></div>
      <div id="plain" style="translate: 1px 1px"></div>`;
    Idiomorph.morph(
      body,
      `<div id="post" data-floor-y="50" style="color: blue"></div>
      <div id="tile" data-floor-area="0 0 50 50"></div>
      <div id="wall" class="rear-wall" style="z-index: 4"></div>
      <div id="plain"></div>`,
      { morphStyle: "innerHTML", callbacks: keepPlacement() },
    );
    const style = (id: string) => body.querySelector<HTMLElement>(`#${id}`)!.style;
    expect(style("post").color).toBe("blue");
    expect(style("post").translate).toBe("10px 20px");
    expect(style("post").scale).toBe("0.5");
    expect(style("tile").transform).toBe("matrix(1, 0, 0, 1, 5, 5)");
    expect(style("wall").zIndex).toBe("4");
    expect(style("plain").translate).toBe("");
  });

  it("doesn't carry a surface's placement onto an element the morph reuses for something else", () => {
    const body = document.createElement("div");
    body.innerHTML = `<div class="floor-background" style="transform: matrix(1, 0, 0, 1, 5, 5); z-index: -3"></div>`;
    Idiomorph.morph(body, `<div id="start">Start</div>`, { morphStyle: "innerHTML", callbacks: keepPlacement() });
    expect(body.querySelector<HTMLElement>("#start")!.getAttribute("style")).toBeNull();
  });
});
