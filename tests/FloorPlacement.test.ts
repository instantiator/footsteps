import { describe, expect, it } from "vitest";
import { floorBandOf, parseFloorItem } from "../src/components/core/layout/FloorPlacement";

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

describe("floorBandOf", () => {
  it("is the band of floor y centred on a thick item, from the item or anything inside it", () => {
    const item = element({ "data-floor-y": "60", "data-floor-thickness": "20" });
    const inside = item.appendChild(document.createElement("span"));
    expect(floorBandOf(item)).toEqual({ min: 50, max: 70 });
    expect(floorBandOf(inside)).toEqual({ min: 50, max: 70 });
  });

  it("is nothing for an item with no thickness, or anything off the floor", () => {
    expect(floorBandOf(element({ "data-floor-y": "60" }))).toBeUndefined();
    expect(floorBandOf(element({ "data-floor-thickness": "20" }))).toBeUndefined();
  });
});
