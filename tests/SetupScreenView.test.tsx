import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETUP_CONSTANTS,
  DEFAULT_SETUP_INPUTS,
  planSetup,
  type SetupInputs,
} from "../src/components/setup/SetupCalculations";
import SetupScreenView from "../src/components/setup/SetupScreenView";

const draw = (inputs: SetupInputs, constants = DEFAULT_SETUP_CONSTANTS) =>
  render(<SetupScreenView plan={planSetup(inputs, constants)} inputs={inputs} constants={constants} />);

describe("SetupScreenView", () => {
  it("draws the room, the game floor, the players and the clear edge inside the screen", () => {
    draw(DEFAULT_SETUP_INPUTS);
    expect(document.querySelector(".setup-screen-floor")).not.toBeNull();
    expect(document.querySelectorAll(".setup-screen-room").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".setup-screen-player")).toHaveLength(2);
    expect(document.querySelector(".setup-screen-clear")).not.toBeNull();
    expect(screen.getByText(/On a 1\.22 m × 0\.68 m screen/)).toBeInTheDocument();
  });

  it("sizes the screen from the assumptions", () => {
    draw(DEFAULT_SETUP_INPUTS, { ...DEFAULT_SETUP_CONSTANTS, screenWidth: 1.6, screenHeight: 0.9 });
    const viewBox = document.querySelector(".setup-screen-view svg")?.getAttribute("viewBox")?.split(" ").map(Number);
    [-0.02, -0.02, 1.64, 0.94].forEach((value, i) => expect(viewBox?.[i]).toBeCloseTo(value));
  });

  it("clips the picture with a reference that resolves", () => {
    draw(DEFAULT_SETUP_INPUTS);
    const reference = document.querySelector(".setup-screen-view g")?.getAttribute("clip-path") ?? "";
    const id = /^url\(#([\w-]+)\)$/.exec(reference)?.[1];
    expect(id && document.getElementById(id)?.tagName.toLowerCase()).toBe("clippath");
  });

  it("draws nothing when no floor fits", () => {
    draw({ ...DEFAULT_SETUP_INPUTS, roomLength: 1 });
    expect(document.querySelector(".setup-screen-view")).toBeNull();
  });
});
