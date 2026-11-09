import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraChoice } from "../src/components/camera/CameraChoice";
import type CharacterCanvas from "../src/components/camera/CharacterCanvas";
import { loadCalibration, saveCalibration } from "../src/components/camera/FloorCalibration";
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
  useCameraPicker: () => ({ choice: camera.choice, stream: undefined }),
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
    <MemoryRouter>
      <CalibrationView backTo="/game/demo" />
    </MemoryRouter>,
  );

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

  it("warns, pauses the walking check and disables Save while more than one person is in view", () => {
    const { container } = renderView();
    seePlayers([personWithFeetAt(1, 50, 70), personWithFeetAt(2, 50, 95)]);
    expect(screen.getByRole("alert")).toHaveTextContent("Only one person");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(container.querySelectorAll(".floorMarkerOn, .floorMarkerOff")).toHaveLength(0);
    expect(container.querySelectorAll(".floorMarker")).toHaveLength(4);

    seePlayers([personWithFeetAt(1, 50, 70)]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(container.querySelectorAll(".floorMarkerOn")).toHaveLength(2);
  });

  it("asks for Save once the player has stood on the floor", () => {
    renderView();
    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    seePlayers([personWithFeetAt(1, 50, 70)]);
    expect(screen.getByText(/Press Save/).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("saves the corners for the chosen camera, and says so", () => {
    camera.choice = { deviceId: "rear", mirror: false };
    renderView();
    expect(screen.getByRole("status")).toHaveTextContent("Not saved yet");
    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(loadCalibration("rear")?.backLeft.x).toBeCloseTo(0.24, 6);
    expect(loadCalibration("default")).toBeUndefined();

    fireEvent.keyDown(corner("Back left corner"), { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("Changes not saved yet");
  });

  it("resets to the default area without saving", () => {
    saveCalibration("default", { ...DEFAULT_CORNERS, backLeft: { x: 0.3, y: 0.5 } });
    renderView();
    expect(positionOf(corner("Back left corner"))).toEqual({ x: 0.3, y: 0.5 });
    fireEvent.click(screen.getByRole("button", { name: "Reset to the default area" }));
    expect(positionOf(corner("Back left corner"))).toEqual(DEFAULT_CORNERS.backLeft);
    expect(loadCalibration("default")?.backLeft).toEqual({ x: 0.3, y: 0.5 });
  });

  it("forgets every saved area only once the player confirms", () => {
    saveCalibration("default", DEFAULT_CORNERS);
    saveCalibration("rear", DEFAULT_CORNERS);
    renderView();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Forget all saved areas" }));
    expect(loadCalibration("rear")).toBeDefined();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Forget all saved areas" }));
    expect(loadCalibration("rear")).toBeUndefined();
    expect(loadCalibration("default")).toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("Not saved yet");
  });
});
