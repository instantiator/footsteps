import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { WEBCAMS, type WebcamConfig } from "../src/components/camera/Webcams";
import { DEFAULT_SETUP_INPUTS, planSetup } from "../src/components/setup/SetupCalculations";
import SetupPlanner from "../src/pages/SetupPlanner";

/** The value shown beside a result's label. */
const result = (label: string) => screen.getByRole("rowheader", { name: label }).nextElementSibling?.textContent;

const floorText = (depth: number, width: number) => `${width.toFixed(2)} m wide × ${depth.toFixed(2)} m deep`;

const field = (label: RegExp) => screen.getByLabelText<HTMLInputElement>(label);

beforeEach(() => {
  render(
    <MemoryRouter>
      <SetupPlanner />
    </MemoryRouter>,
  );
});

describe("SetupPlanner", () => {
  it("shows the recommendation for the default values", () => {
    const plan = planSetup(DEFAULT_SETUP_INPUTS);
    expect(result("Floor")).toBe(floorText(plan.floorDepth, plan.floorWidth));
    expect(result("Camera height")).toBe(`${plan.cameraHeight.toFixed(2)} m`);
    expect(result("Camera tilt, below horizontal")).toBe(`${plan.tiltDegrees.toFixed(0)}°`);
  });

  it("recalculates as a value changes", () => {
    fireEvent.change(field(/Room length/), { target: { value: "3.5" } });
    const plan = planSetup({ ...DEFAULT_SETUP_INPUTS, roomLength: 3.5 });
    expect(result("Floor")).toBe(floorText(plan.floorDepth, plan.floorWidth));
  });

  it("steps values with − and +, rounding to the step and stopping at the minimum", () => {
    fireEvent.click(screen.getByRole("button", { name: "Increase room width" }));
    expect(field(/Room width/).value).toBe("4.3");
    const decrease = screen.getByRole("button", { name: "Decrease space above the camera" });
    for (let i = 0; i < 6; i++) fireEvent.click(decrease);
    expect(field(/Space above the camera/).value).toBe("0");
  });

  it("steps a blank optional field from its fallback", () => {
    fireEvent.click(screen.getByRole("button", { name: "Decrease ceiling height (optional)" }));
    expect(field(/Ceiling height/).value).toBe("2.35");
  });

  it("keeps the camera under a low ceiling", () => {
    fireEvent.change(field(/Ceiling height/), { target: { value: "2" } });
    expect(Number.parseFloat(result("Camera height") ?? "")).toBeLessThanOrEqual(1.8);
  });

  it("restores the assumptions' defaults", () => {
    fireEvent.click(screen.getByRole("button", { name: "Increase steepest tilt" }));
    expect(field(/Steepest tilt/).value).toBe("36");
    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(field(/Steepest tilt/).value).toBe("35");
  });

  it("warns about a room too small to play in", () => {
    fireEvent.change(field(/Room length/), { target: { value: "1" } });
    expect(screen.getByText(/^Not enough space/)).toBeInTheDocument();
  });

  it("explains a field of view too wide to plan for", () => {
    fireEvent.change(field(/Diagonal field of view/), { target: { value: "170" } });
    expect(screen.getByText(/The camera's view is too wide/)).toBeInTheDocument();
  });

  it("shows the field of view a measurement implies", () => {
    fireEvent.change(screen.getByLabelText("Picture shape"), { target: { value: String(4 / 3) } });
    fireEvent.change(field(/Camera's distance from a wall/), { target: { value: "1" } });
    fireEvent.change(field(/Width of wall it shows/), { target: { value: "1" } });
    expect(result("Diagonal field of view measured")).toBe("64°");
  });
});

describe("the known webcam choice", () => {
  const [lifecamHd, lifecamSd] = WEBCAMS;
  const useWebcam = (config?: WebcamConfig) => {
    const choice = screen.getByLabelText<HTMLSelectElement>("Known webcam");
    fireEvent.change(choice, { target: { value: String(WEBCAMS.indexOf(config ?? lifecamHd)) } });
    fireEvent.click(screen.getByRole("button", { name: "Use this camera" }));
  };

  it("fills in a webcam's field of view and shape, and recalculates", () => {
    const before = result("Floor");
    useWebcam(lifecamSd);
    expect(field(/Diagonal field of view/).value).toBe("58");
    expect(screen.getByLabelText<HTMLSelectElement>("Picture shape").value).toBe(String(4 / 3));
    expect(result("Floor")).not.toBe(before);
  });

  const unknownFov = WEBCAMS.find(({ diagonalFov }) => diagonalFov === undefined);
  it.skipIf(!unknownFov)("keeps the field of view for a webcam whose field of view isn't known", () => {
    fireEvent.change(field(/Diagonal field of view/), { target: { value: "70" } });
    useWebcam(unknownFov);
    expect(field(/Diagonal field of view/).value).toBe("70");
  });

  it("replaces a measurement", () => {
    fireEvent.change(field(/Camera's distance from a wall/), { target: { value: "1" } });
    useWebcam(lifecamHd);
    expect(field(/Camera's distance from a wall/).value).toBe("");
  });
});
