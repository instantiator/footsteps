import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { templateMessages } from "../src/components/core/logic/TemplateChecks";

describe("templateMessages", () => {
  it("reports data-depth as a problem", () => {
    expect(templateMessages('<div data-depth="3"></div>', true).problems).toEqual([
      expect.stringContaining("data-depth is no longer supported"),
    ]);
  });

  it("warns of data-fill-width on a side wall", () => {
    expect(templateMessages('<div class="left-wall" data-fill-width></div>', true).warnings).toEqual([
      expect.stringContaining("data-fill-width does nothing here"),
    ]);
  });

  it("warns of a floor item in a scene that never shows in 2.5D", () => {
    expect(templateMessages('<div data-floor-y="50"></div>', false).warnings).toEqual([
      expect.stringContaining("data-floor-* does nothing here"),
    ]);
  });

  it("finds nothing wrong with a clean 2.5D template", () => {
    const text =
      '<div class="floor-background"></div><div class="rear-wall" data-fill-width></div><div data-floor-y="50"></div>';
    expect(templateMessages(text, true)).toEqual({ problems: [], warnings: [] });
  });

  it.each(readdirSync("docs/tutorials/samples"))("finds nothing wrong with the sample %s", (name) => {
    const text = readFileSync(`docs/tutorials/samples/${name}`, "utf8");
    expect(templateMessages(text, true)).toEqual({ problems: [], warnings: [] });
  });
});
