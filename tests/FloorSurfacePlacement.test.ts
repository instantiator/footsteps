import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cropPlacement, DEFAULT_CORNERS, floorCrop, type FloorView } from "../src/components/camera/FloorGeometry";
import { depthZIndex } from "../src/components/camera/PlayerPosition";
import { useFloorPlacement } from "../src/components/core/layout/FloorPlacement";
import {
  BACKGROUND_DISTANCE,
  DEFAULT_WALL_HEIGHT,
  parseFloorArea,
  parseSurface,
  placeSurface,
  SURFACE_CLASSES,
  surfaceZIndex,
} from "../src/components/core/layout/FloorSurfacePlacement";

const VIEW: FloorView = {
  corners: DEFAULT_CORNERS,
  crop: cropPlacement(floorCrop(DEFAULT_CORNERS), false),
  mirrored: false,
};

/** An element from markup, with the box size jsdom can't lay out. */
const element = (html: string, size = { width: 200, height: 100 }): HTMLElement => {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const made = holder.firstElementChild as HTMLElement;
  Object.defineProperty(made, "offsetWidth", { value: size.width });
  Object.defineProperty(made, "offsetHeight", { value: size.height });
  return made;
};

describe("parseFloorArea", () => {
  it("reads left, back, right and front, putting each pair in order", () => {
    expect(parseFloorArea("10 20 30 40")).toEqual({ left: 10, back: 20, right: 30, front: 40 });
    expect(parseFloorArea(" 30  40 10 20 ")).toEqual({ left: 10, back: 20, right: 30, front: 40 });
  });

  it.each([null, "", "10 20 30", "10 20 30 40 50", "a b c d", "10 20 30 Infinity"])("rejects %j", (value) => {
    expect(parseFloorArea(value)).toBeUndefined();
  });
});

describe("parseSurface", () => {
  it("knows every surface class, with walls on the edge and backgrounds set back", () => {
    for (const kind of SURFACE_CLASSES) {
      const surface = parseSurface(element(`<div class="scenery ${kind}"></div>`));
      expect(surface?.kind).toBe(kind);
      expect(surface?.distance).toBe(kind.endsWith("-background") ? BACKGROUND_DISTANCE : 0);
      expect(surface?.height).toBe(DEFAULT_WALL_HEIGHT);
    }
  });

  it("reads a floor area, a wall's height and a distance", () => {
    expect(parseSurface(element(`<div data-floor-area="0 0 50 50"></div>`))).toEqual({
      kind: "floor-area",
      area: { left: 0, back: 0, right: 50, front: 50 },
      height: DEFAULT_WALL_HEIGHT,
      distance: 0,
    });
    const wall = parseSurface(element(`<div class="rear-wall" data-floor-height="20" data-wall-distance="5"></div>`));
    expect(wall).toMatchObject({ height: 20, distance: 5 });
  });

  it("isn't a surface without a class, or with a malformed floor area", () => {
    expect(parseSurface(element(`<div class="my-rear-wall-x"></div>`))).toBeNull();
    expect(parseSurface(element(`<div class="rear-wall" data-floor-area="1 2"></div>`))).toBeNull();
  });
});

describe("surfaceZIndex", () => {
  it("paints back to front: horizon, ground, backgrounds, the floor, its areas, then walls", () => {
    const order = [
      "horizon-background",
      "ground-background",
      "rear-background",
      "floor-background",
      "floor-area",
      "rear-wall",
      "front-wall",
    ] as const;
    const zs = order.map((kind) => surfaceZIndex(kind, false));
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    expect(Math.max(...zs)).toBeLessThan(depthZIndex(0));
  });

  it("stands walls behind or in front of every player in the depth stack", () => {
    for (const kind of ["rear-wall", "left-wall", "right-wall"] as const) {
      expect(surfaceZIndex(kind, true)).toBeLessThan(depthZIndex(0));
    }
    expect(surfaceZIndex("front-wall", true)).toBeGreaterThan(depthZIndex(100));
    expect(surfaceZIndex("floor-area", true)).toBeLessThan(surfaceZIndex("rear-wall", true));
  });
});

describe("placeSurface", () => {
  const size = { width: 1240, height: 1000 };

  it("draws a surface with a matrix3d from its top left, and leaves anything else alone", () => {
    const tile = element(`<div data-floor-area="0 0 50 50"></div>`);
    expect(placeSurface(tile, VIEW, size, { x: 0, y: 0 })).toBe(true);
    expect(tile.style.transform).toMatch(/^matrix3d\(/);
    expect(tile.style.transformOrigin).toBe("0 0");
    expect(tile.style.zIndex).toBe(String(surfaceZIndex("floor-area", false)));

    const other = element(`<div class="scenery"></div>`);
    expect(placeSurface(other, VIEW, size, { x: 0, y: 0 })).toBe(false);
    expect(other.getAttribute("style")).toBeNull();
  });

  it("hides a horizon there is none of, and a surface with no box", () => {
    const flat: FloorView = {
      corners: {
        backLeft: { x: 0.1, y: 0.2 },
        backRight: { x: 0.9, y: 0.2 },
        frontRight: { x: 0.9, y: 0.9 },
        frontLeft: { x: 0.1, y: 0.9 },
      },
      crop: VIEW.crop,
      mirrored: false,
    };
    const horizon = element(`<div class="horizon-background"></div>`);
    placeSurface(horizon, flat, size, { x: 0, y: 0 });
    expect(horizon.style.visibility).toBe("hidden");
    const empty = element(`<div class="floor-background"></div>`, { width: 0, height: 0 });
    placeSurface(empty, VIEW, size, { x: 0, y: 0 });
    expect(empty.style.visibility).toBe("hidden");
  });
});

describe("useFloorPlacement", () => {
  it("draws surfaces while the floor shows, and takes the styles off again when it stops", () => {
    const viewport = document.createElement("div");
    Object.defineProperty(viewport, "clientWidth", { value: 1240 });
    Object.defineProperty(viewport, "clientHeight", { value: 1000 });
    const wall = element(`<div class="rear-wall" style="color: red"></div>`);
    viewport.append(wall);
    document.body.append(viewport);

    const { unmount } = renderHook(() => useFloorPlacement({ current: viewport }, VIEW));
    expect(wall.style.transform).toMatch(/^matrix3d\(/);
    unmount();
    expect(wall.style.transform).toBe("");
    expect(wall.style.zIndex).toBe("");
    expect(wall.style.color).toBe("red");
    viewport.remove();
  });
});
