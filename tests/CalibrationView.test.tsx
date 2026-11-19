import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraChoice } from "../src/components/camera/CameraChoice";
import type CharacterCanvas from "../src/components/camera/CharacterCanvas";
import { cameraKeyOf, loadCalibration, saveCalibration } from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS, isValidFloor, type Corners } from "../src/components/camera/FloorGeometry";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import CalibrationView from "../src/components/landing/CalibrationView";
import { noKeyPoints } from "../src/vision/VisionTypes";

type CanvasProps = ComponentProps<typeof CharacterCanvas>;

/** The camera the (mocked) picker has chosen, and the props the (mocked) tracking last had. */
const camera = vi.hoisted(() => ({
  choice: { mirror: false } as CameraChoice,
  canvas: undefined as CanvasProps | undefined,
}));

vi.mock("../src/components/landing/useCameraPicker", () => ({
  useCameraPicker: () => ({
    choice: camera.choice,
    stream: undefined,
    cameras: [{ deviceId: "lifecam", label: "LifeCam HD-3000", kind: "videoinput", groupId: "g", toJSON: () => ({}) }],
    activeDeviceId: "lifecam",
    options: [{ name: "HD (1280×720)", width: 1280, height: 720 }],
  }),
}));

vi.mock("../src/components/camera/CharacterCanvas", () => ({
  default: (props: CanvasProps) => {
    camera.canvas = props;
    return null;
  },
}));

/** Hands the view one frame of the people the camera found. */
const seePlayers = (players: PlayerFrame[]) => act(() => camera.canvas?.onPlayersChange?.(players, 0));

/** A person in a 100×100 mask with their feet at the given image percentages. */
const personWithFeetAt = (id: number, x: number, y: number): PlayerFrame => ({
  id,
  mask: new Uint8Array(100 * 100),
  keyPoints: { ...noKeyPoints(), leftFoot: { x, y }, rightFoot: { x: x + 1, y } },
  scale: 1,
  width: 100,
  height: 100,
  feet: null,
  position: null,
});

const renderView = () =>
  render(
    <MemoryRouter initialEntries={["/game/demo/calibrate"]}>
      <Routes>
        <Route path="/game/demo/calibrate" element={<CalibrationView backTo="/game/demo" title="Demo scenes" />} />
        <Route path="/game/demo" element={<p>The landing page</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** The calibrating panel's heading. */
const heading = () => screen.getByRole("heading", { level: 2 });

const corner = (name: string) => screen.getByRole("button", { name });
const positionOf = (element: HTMLElement) => ({
  x: parseFloat(element.style.left) / 100,
  y: parseFloat(element.style.top) / 100,
});

beforeEach(() => {
  camera.choice = { mirror: false };
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("CalibrationView", () => {
  it("offers the four corners in turn, named as the player sees them", () => {
    renderView();
    const names = screen
      .getAllByRole("button")
      .filter((button) => button.classList.contains("calibration-corner"))
      .map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(["Back left corner", "Back right corner", "Front right corner", "Front left corner"]);
    expect(screen.getByText(/Drag each blue corner/).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("names the corners from the picture's side when it is mirrored", () => {
    camera.choice = { mirror: true };
    renderView();
    expect(screen.getAllByRole("button", { name: /corner/ })[0]).toHaveAccessibleName("Back right corner");
  });

  it("moves the focused corner with the arrow keys, further with Shift", () => {
    renderView();
    const backLeft = corner("Back left corner");
    fireEvent.keyDown(backLeft, { key: "ArrowLeft" });
    expect(positionOf(backLeft).x).toBeCloseTo(0.24, 6);
    fireEvent.keyDown(backLeft, { key: "ArrowUp", shiftKey: true });
    expect(positionOf(backLeft).y).toBeCloseTo(0.5, 6);
    expect(screen.getByText(/Walk to each corner/).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("moves a mirrored picture's corner the way the arrow points on screen", () => {
    camera.choice = { mirror: true };
    renderView();
    const onScreenLeft = corner("Back right corner"); // the image's back left
    fireEvent.keyDown(onScreenLeft, { key: "ArrowLeft" });
    expect(positionOf(onScreenLeft).x).toBeCloseTo(0.26, 6);
  });

  it("drags a corner with the pointer, stopping at the limit of a convex floor", () => {
    renderView();
    const backRight = corner("Back right corner");
    vi.spyOn(backRight.parentElement!, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));

    fireEvent.pointerDown(backRight, { pointerId: 1, clientX: 75, clientY: 55 });
    fireEvent.pointerMove(backRight, { pointerId: 1, clientX: 70, clientY: 50 });
    expect(positionOf(backRight)).toEqual({ x: 0.7, y: 0.5 });

    // Across the floor and below the front edge would fold it
    fireEvent.pointerMove(backRight, { pointerId: 1, clientX: 30, clientY: 95 });
    fireEvent.pointerUp(backRight, { pointerId: 1 });
    const [backLeft, , frontRight, frontLeft] = screen.getAllByRole("button", { name: /corner/ }).map(positionOf);
    const corners: Corners = { backLeft, backRight: positionOf(backRight), frontRight, frontLeft };
    expect(isValidFloor(corners)).toBe(true);
    expect(positionOf(backRight).x).toBeGreaterThan(0.3);

    // A move after the drag ends does nothing
    fireEvent.pointerMove(backRight, { pointerId: 1, clientX: 60, clientY: 50 });
    expect(positionOf(backRight).x).not.toBe(0.6);
  });

  it("warns over the picture, pauses the walking check and disables saving while more than one person is in view", () => {
    const { container } = renderView();
    seePlayers([personWithFeetAt(1, 50, 70), personWithFeetAt(2, 50, 95)]);
    expect(screen.getByText(/Only one person/).closest(".calibration-frame")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save and close" })).toBeDisabled();
    expect(container.querySelectorAll(".floorMarkerOn, .floorMarkerOff")).toHaveLength(0);
    expect(container.querySelectorAll(".floorMarker")).toHaveLength(4);

    seePlayers([personWithFeetAt(1, 50, 70)]);
    expect(screen.queryByText(/Only one person/)).toBeNull();
    expect(screen.getByRole("button", { name: "Save and close" })).toBeEnabled();
    expect(container.querySelectorAll(".floorMarkerOn")).toHaveLength(2);
  });

  it("asks for Save and close once the player has stood on the floor", () => {
    renderView();
    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    seePlayers([personWithFeetAt(1, 50, 70)]);
    expect(screen.getByText(/Press Save and close/).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("titles the page with the game, and names the camera and configuration being calibrated", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Demo scenes: Floor calibration");
    expect(heading()).toHaveTextContent(/^Calibrating: LifeCam HD-3000 · HD \(1280×720\)/);
  });

  it("marks an uncalibrated configuration's default corners as unsaved, until saved", () => {
    renderView();
    expect(heading()).toHaveTextContent(/\*$/);
  });

  it("marks a saved configuration unsaved only once a corner moves", () => {
    saveCalibration(cameraKeyOf({}), DEFAULT_CORNERS);
    renderView();
    expect(heading()).not.toHaveTextContent(/\*$/);
    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    expect(heading()).toHaveTextContent(/\*$/);
  });

  it("saves the corners for the chosen configuration, and goes back to the game", () => {
    camera.choice = { deviceId: "rear", mirror: false };
    renderView();
    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Save and close" }));

    expect(loadCalibration(cameraKeyOf({ deviceId: "rear" }))?.backLeft.x).toBeCloseTo(0.24, 6);
    expect(loadCalibration(cameraKeyOf({}))).toBeUndefined();
    expect(screen.getByText("The landing page")).toBeInTheDocument();
  });

  it("closes without asking when nothing is unsaved", () => {
    saveCalibration(cameraKeyOf({}), DEFAULT_CORNERS);
    const confirm = vi.spyOn(window, "confirm");
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText("The landing page")).toBeInTheDocument();
  });

  it("asks before closing with unsaved changes, and stays if the player cancels", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("The landing page")).toBeNull();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("The landing page")).toBeInTheDocument();
    expect(loadCalibration(cameraKeyOf({}))).toBeUndefined();
  });

  it("resets to the default corners without saving", () => {
    saveCalibration(cameraKeyOf({}), { ...DEFAULT_CORNERS, backLeft: { x: 0.3, y: 0.5 } });
    renderView();
    expect(positionOf(corner("Back left corner"))).toEqual({ x: 0.3, y: 0.5 });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(positionOf(corner("Back left corner"))).toEqual(DEFAULT_CORNERS.backLeft);
    expect(heading()).toHaveTextContent(/\*$/);
    expect(loadCalibration(cameraKeyOf({}))?.backLeft).toEqual({ x: 0.3, y: 0.5 });
  });

  it("clears every saved floor only once the player confirms, leaving the corners unsaved", () => {
    saveCalibration(cameraKeyOf({}), DEFAULT_CORNERS);
    saveCalibration("rear", DEFAULT_CORNERS);
    renderView();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Clear all calibrations" }));
    expect(loadCalibration("rear")).toBeDefined();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear all calibrations" }));
    expect(loadCalibration("rear")).toBeUndefined();
    expect(loadCalibration(cameraKeyOf({}))).toBeUndefined();
    expect(heading()).toHaveTextContent(/\*$/);
  });

  it("plans the space for this camera in a new tab", () => {
    renderView();
    const plan = screen.getByRole("link", { name: "Plan space" });
    expect(plan).toHaveAttribute("href", "/setup?camera=LifeCam+HD-3000&size=1280x720");
    expect(plan).toHaveAttribute("target", "_blank");
  });
});
