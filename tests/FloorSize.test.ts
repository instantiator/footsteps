import { describe, expect, it } from "vitest";
import { DEFAULT_FLOOR_SIZE, floorScale, floorSizeOfText, textOfFloorSize } from "../src/components/camera/FloorSize";

describe("floor scale", () => {
  it("sizes people and doors in floor units, which are 1% of the floor's width", () => {
    expect(floorScale({ width: 4, depth: 2 })).toEqual({
      metre: 25,
      metreDeep: 50,
      person: 42.5,
      waist: 22.5,
      chest: 32.5,
      door: 50,
      doorWidth: 22.5,
    });
  });

  it("makes everything bigger on a smaller floor, to one decimal place", () => {
    const { person, metre } = floorScale(DEFAULT_FLOOR_SIZE);
    expect(metre).toBe(38.5);
    expect(person).toBe(65.4);
  });
});

describe("floor size as typed", () => {
  it("is no size when both are blank, a size when both are sensible, and invalid otherwise", () => {
    expect(floorSizeOfText({ width: "", depth: " " })).toBeUndefined();
    expect(floorSizeOfText({ width: "3.2", depth: "2" })).toEqual({ width: 3.2, depth: 2 });
    expect(floorSizeOfText({ width: "3", depth: "" })).toBe("invalid");
    expect(floorSizeOfText({ width: "0.1", depth: "2" })).toBe("invalid");
    expect(floorSizeOfText({ width: "30", depth: "2" })).toBe("invalid");
  });

  it("round-trips a saved size, and shows none as blank", () => {
    expect(floorSizeOfText(textOfFloorSize({ width: 3.2, depth: 2 }))).toEqual({ width: 3.2, depth: 2 });
    expect(textOfFloorSize(undefined)).toEqual({ width: "", depth: "" });
  });
});
