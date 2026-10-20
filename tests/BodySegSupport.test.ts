import { describe, expect, it, vi } from "vitest";

vi.mock("@tensorflow-models/body-segmentation", () => ({}));

import { BODY_PARTS, maskValueToColor } from "../src/components/camera/BodySegSupport";

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

describe("maskValueToColor", () => {
  it.each(["binary", "colored"] as const)("gives a body part its own colour for %s masks", (maskType) => {
    expect(maskValueToColor(BODY_PARTS.TORSO_FRONT.maskValue, maskType)).toEqual(BODY_PARTS.TORSO_FRONT.color);
    expect(maskValueToColor(BODY_PARTS.LEFT_FOOT.maskValue, maskType)).toEqual(BODY_PARTS.LEFT_FOOT.color);
  });

  it.each(["LEFT_HAND", "RIGHT_HAND", "LEFT_FOOT", "RIGHT_FOOT"])("colours %s in an extremities mask", (part) => {
    expect(maskValueToColor(BODY_PARTS[part].maskValue, "extremities")).toEqual(BODY_PARTS[part].color);
  });

  it("leaves the rest of the body transparent in an extremities mask", () => {
    expect(maskValueToColor(BODY_PARTS.TORSO_FRONT.maskValue, "extremities")).toEqual(TRANSPARENT);
    expect(maskValueToColor(BODY_PARTS.LEFT_FACE.maskValue, "extremities")).toEqual(TRANSPARENT);
  });

  it("is transparent for a mask value that is no body part", () => {
    expect(maskValueToColor(999, "colored")).toEqual(TRANSPARENT);
    expect(maskValueToColor(-1, "extremities")).toEqual(TRANSPARENT);
  });
});
