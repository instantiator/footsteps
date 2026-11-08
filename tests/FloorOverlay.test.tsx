import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import FloorOverlay from "../src/components/camera/FloorOverlay";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import { noKeyPoints, type KeyPoints } from "../src/vision/VisionTypes";

/** A player in a 100×100 mask with the given key points, in mask pixels. */
const player = (keyPoints: Partial<KeyPoints>, held = false): PlayerFrame => ({
  id: 1,
  mask: new Uint8Array(100 * 100),
  keyPoints: { ...noKeyPoints(), ...keyPoints },
  scale: 1,
  width: 100,
  height: 100,
  feet: null,
  ...(held && { held: { opacity: 0.5 } }),
});

/** One foot on the default floor and one in front of it. */
const STRADDLING = player({ leftFoot: { x: 50, y: 70 }, rightFoot: { x: 50, y: 95 } });

describe("FloorOverlay", () => {
  it("outlines the floor through its corners", () => {
    const { container } = render(<FloorOverlay corners={DEFAULT_CORNERS} />);
    expect(container.querySelector("polygon")?.getAttribute("points")).toBe("0.25,0.55 0.75,0.55 0.92,0.9 0.08,0.9");
  });

  it("shows a foot on the floor green and one off it red, placed in fractions of the image", () => {
    const { container } = render(<FloorOverlay corners={DEFAULT_CORNERS} players={[STRADDLING]} />);
    const [on, off] = Array.from(container.querySelectorAll<HTMLElement>(".floorMarker"));
    expect(on).toHaveClass("floorMarkerOn");
    expect(on).toHaveStyle({ left: "50%", top: "70%" });
    expect(off).toHaveClass("floorMarkerOff");
  });

  it("leaves the feet neutral with no floor, or while the check is paused", () => {
    for (const overlay of [
      <FloorOverlay key="none" players={[STRADDLING]} />,
      <FloorOverlay key="paused" corners={DEFAULT_CORNERS} players={[STRADDLING]} checkFeet={false} />,
    ]) {
      const { container, unmount } = render(overlay);
      expect(container.querySelectorAll(".floorMarkerOn, .floorMarkerOff")).toHaveLength(0);
      expect(container.querySelectorAll(".floorMarker")).toHaveLength(2);
      unmount();
    }
    expect(render(<FloorOverlay players={[STRADDLING]} />).container.querySelector("polygon")).toBeNull();
  });

  it("marks the head at the middle of its points and the hands, and fades a held player's markers", () => {
    const { container } = render(
      <FloorOverlay
        players={[
          player(
            { headTop: { x: 40, y: 10 }, headBottom: { x: 40, y: 20 }, leftHand: { x: 20, y: 40 }, rightHand: null },
            true,
          ),
        ]}
      />,
    );
    const [head, hand] = Array.from(container.querySelectorAll<HTMLElement>(".floorMarker"));
    expect(head).toHaveClass("floorMarkerHead");
    expect(parseFloat(head.style.top)).toBeCloseTo(15, 6);
    expect(head).toHaveStyle({ left: "40%" });
    expect(hand).toHaveStyle({ left: "20%", top: "40%" });
    expect(hand).toHaveClass("floorMarkerHeld");
  });
});
