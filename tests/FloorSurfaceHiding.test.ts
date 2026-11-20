import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLOOR_AREA_ATTRIBUTE, SURFACE_CLASSES } from "../src/components/core/layout/FloorSurfaceClasses";

/** The stylesheet's rule that hides floor surfaces until they are placed. */
const hidingRule = (): string => {
  const css = readFileSync("src/components/core/layout/GameLayersLayout.css", "utf8");
  const start = css.indexOf(".floorScene\n  :where(");
  return css.slice(start, css.indexOf("}", start));
};

describe("hiding floor surfaces until they are placed", () => {
  it("covers every surface class and floor areas", () => {
    const rule = hidingRule();
    expect(rule).toContain("visibility: hidden");
    expect(rule).toContain(`[${FLOOR_AREA_ATTRIBUTE}]`);
    for (const name of SURFACE_CLASSES) expect(rule).toContain(`.${name}`);
  });
});
