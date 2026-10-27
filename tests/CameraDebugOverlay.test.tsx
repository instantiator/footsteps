import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CameraDebugOverlay from "../src/components/camera/CameraDebugOverlay";

const at = (x: number, y: number) => ({ absolute: { x, y }, percent: { x, y } });

describe("CameraDebugOverlay", () => {
  it("marks a seen player's feet with a solid dot, and a held player's with a faded ring", () => {
    const { container } = render(
      <CameraDebugOverlay feetPositions={{ 0: at(10, 90), 1: { ...at(60, 80), held: true } }} />,
    );
    const [seen, held] = Array.from(container.querySelectorAll<HTMLElement>(".foot-marker"));

    expect(seen).toHaveStyle({ left: "10%", top: "90%" });
    expect(seen.style.backgroundColor).toBe("lightgreen");
    expect(seen).not.toHaveClass("foot-marker-held");
    expect(held).toHaveClass("foot-marker-held");
    expect(held).toHaveStyle({ left: "60%", opacity: "0.5" });
    expect(held.style.backgroundColor).toBe("");
  });
});
