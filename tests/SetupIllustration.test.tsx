import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP_INPUTS, planSetup, type SetupInputs } from "../src/components/setup/SetupCalculations";
import SetupIllustration from "../src/components/setup/SetupIllustration";

const draw = (inputs: SetupInputs) => render(<SetupIllustration plan={planSetup(inputs)} inputs={inputs} />);

const floorPoints = () => document.querySelector(".setup-floor")?.getAttribute("points");

describe("SetupIllustration", () => {
  it("labels every dimension with its value", () => {
    const plan = planSetup(DEFAULT_SETUP_INPUTS);
    draw(DEFAULT_SETUP_INPUTS);
    const m = (value: number) => `${value.toFixed(2)} m`;
    for (const label of [
      `W ${m(plan.floorWidth)}`,
      `D ${m(plan.floorDepth)}`,
      `to floor ${m(plan.nearDistance)}`,
      `h ${m(plan.cameraHeight)}, tilt ${plan.tiltDegrees.toFixed(0)}°`,
      `left ${m(plan.marginLeft)}`,
      `right ${m(plan.marginRight)}`,
      `beyond ${m(plan.marginFar)}`,
      `behind ${m(plan.marginBehind)}`,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("img")).toHaveAccessibleName(/^A 2\.50 m by .* floor/);
  });

  it("redraws the floor when its width changes", () => {
    const { unmount } = draw(DEFAULT_SETUP_INPUTS);
    const wide = floorPoints();
    unmount();
    draw({ ...DEFAULT_SETUP_INPUTS, roomWidth: 2 });
    expect(floorPoints()).not.toBe(wide);
  });

  it("says so instead of drawing when no floor fits", () => {
    draw({ ...DEFAULT_SETUP_INPUTS, roomLength: 1 });
    expect(screen.getByText(/No floor fits/)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
  });
});
