import { describe, expect, it } from "vitest";
import { summariseTemplateSource } from "../src/components/core/logic/TemplateUtils";

describe("summariseTemplateSource", () => {
  it("names a sourced template by its type and location", () => {
    expect(summariseTemplateSource({ sourceType: "relative", templateSource: "t.mustache" }, "r1")).toBe(
      "relative:t.mustache",
    );
  });

  it("uses the given fallback id, so it is stable across renders, for a template with no location", () => {
    expect(summariseTemplateSource({ sourceType: "embedded", content: "<p/>" }, "r1")).toBe("embedded:uid:r1");
    expect(summariseTemplateSource(undefined, "r2")).toBe("undefined:uid:r2");
  });
});
