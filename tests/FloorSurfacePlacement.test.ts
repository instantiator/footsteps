import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cropPlacement, DEFAULT_CORNERS, floorCrop, type FloorView } from "../src/components/camera/FloorGeometry";
import { depthZIndex } from "../src/components/camera/PlayerPosition";
import { useFloorPlacement } from "../src/components/core/layout/FloorPlacement";
import { HORIZON_DISTANCE } from "../src/components/camera/FloorSurfaces";
import {
  BACKGROUND_DISTANCE,
  parseFloorArea,
  parseSurface,
  placeSurface,
  surfaceZIndex,
} from "../src/components/core/layout/FloorSurfacePlacement";
import { SURFACE_CLASSES } from "../src/components/core/layout/FloorSurfaceClasses";

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
  it("knows every surface class: walls on the edge, backgrounds set back, and the horizon far away", () => {
    const far = ["horizon-background", "floor-background"];
    for (const kind of SURFACE_CLASSES) {
      const surface = parseSurface(element(`<div class="scenery ${kind}"></div>`));
      expect(surface?.kind).toBe(kind);
      const distance = far.includes(kind) ? HORIZON_DISTANCE : kind.endsWith("-background") ? BACKGROUND_DISTANCE : 0;
      expect(surface?.distance).toBe(distance);
      expect(surface?.height).toBeUndefined();
    }
  });

  it("reads a floor area, a height, a distance, a depth and how a surface fills the screen", () => {
    expect(parseSurface(element(`<div data-floor-area="0 0 50 50"></div>`))).toEqual({
      kind: "floor-area",
      area: { left: 0, back: 0, right: 50, front: 50 },
      height: undefined,
      distance: 0,
      depth: 0,
      fillHeight: false,
      fillWidth: false,
      fillEdge: "far",
    });
    const wall = parseSurface(
      element(
        `<div class="rear-wall" data-floor-height="20" data-wall-distance="5" data-fill-height data-fill-width data-fill-edge="near"></div>`,
      ),
    );
    expect(wall).toMatchObject({ height: 20, distance: 5, fillHeight: true, fillWidth: true, fillEdge: "near" });
    expect(parseSurface(element(`<div class="floor-background" data-floor-depth="4"></div>`))?.depth).toBe(4);
  });

  it("isn't a surface without a class, or with a malformed floor area", () => {
    expect(parseSurface(element(`<div class="my-rear-wall-x"></div>`))).toBeNull();
    expect(parseSurface(element(`<div class="rear-wall" data-floor-area="1 2"></div>`))).toBeNull();
  });
});

describe("surfaceZIndex", () => {
  it("paints back to front: the screen, the horizon, the floor background, backgrounds, floor areas, then walls", () => {
    const order = [
      "screen-background",
      "horizon-background",
      "floor-background",
      "rear-background",
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
    const empty = element(`<div class="rear-wall"></div>`, { width: 0, height: 0 });
    placeSurface(empty, VIEW, size, { x: 0, y: 0 });
    expect(empty.style.visibility).toBe("hidden");
  });

  it("sizes the box of a surface it works out the size of, at the floor's scale, and lets go when it stops", () => {
    const wall = element(`<div class="rear-wall" data-floor-height="20"></div>`, { width: 1240, height: 50 });
    placeSurface(wall, VIEW, size, { x: 0, y: 0 });
    // The floor's front edge spans the 1240 pixel viewport: 12.4 pixels a floor unit, for a 100 by 20 wall
    expect(wall.style.width).toBe("1240px");
    expect(wall.style.height).toBe("248px");
    expect(wall.style.getPropertyValue("--floor-unit")).toBe("12.4000px");

    wall.removeAttribute("data-floor-height");
    placeSurface(wall, VIEW, size, { x: 0, y: 0 });
    expect(wall.style.width).toBe("");
    expect(wall.style.getPropertyValue("--floor-unit")).toBe("");
  });

  it("keeps a widened wall as high as its own box's shape made it, frame after frame", () => {
    const holder = document.createElement("div");
    holder.innerHTML = `<div class="rear-wall" data-fill-width></div>`;
    const wall = holder.firstElementChild as HTMLElement;
    // Its box is a tenth as high as it is wide, until the engine sizes it
    const sized = (property: "width" | "height", own: number) => () => parseFloat(wall.style[property]) || own;
    Object.defineProperty(wall, "offsetWidth", { get: sized("width", 1240) });
    Object.defineProperty(wall, "offsetHeight", { get: sized("height", 124) });
    const heights = [1, 2, 3].map(() => {
      placeSurface(wall, VIEW, size, { x: 0, y: 0 });
      return wall.style.height;
    });
    // 10 floor units high, at 12.4 pixels a unit
    expect(heights).toEqual(["124px", "124px", "124px"]);
  });

  it("stretches the screen background over the whole viewport, with a box its size", () => {
    const backdrop = element(`<div class="screen-background"></div>`);
    placeSurface(backdrop, VIEW, size, { x: 100, y: 0 });
    expect(backdrop.style.width).toBe("1240px");
    expect(backdrop.style.height).toBe("1000px");
    // Drawn from its own top left, which the layout put 100 pixels in, back to the viewport's
    expect(backdrop.style.transform).toBe("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -100, 0, 0, 1)");
  });

  it("draws a large floor background at a smaller scale, so its box stays a manageable size", () => {
    const water = element(`<div class="floor-background"></div>`);
    placeSurface(water, VIEW, size, { x: 0, y: 0 });
    expect(Math.max(parseFloat(water.style.width), parseFloat(water.style.height))).toBeCloseTo(4096, 0);
    expect(parseFloat(water.style.getPropertyValue("--floor-unit"))).toBeLessThan(12.4);
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
