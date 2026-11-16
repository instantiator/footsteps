import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cropPlacement, DEFAULT_CORNERS, floorCrop, floorToViewport } from "../src/components/camera/FloorGeometry";
import MouseFeetAvatar, { type DrawFeet } from "../src/components/core/layout/MouseFeetAvatar";
import { FEET_DEFAULTS, type ResolvedFeet } from "../src/components/core/logic/AvatarModeUtils";
import { GameDataContext } from "../src/providers/GameDataContext";
import { simpleGameData } from "./data/SampleGameState";

/** The default floor, filling the whole box. */
const FLOOR = { corners: DEFAULT_CORNERS, crop: cropPlacement(floorCrop(DEFAULT_CORNERS), false), mirrored: false };

/** The box the avatar is drawn in, as the depth stack it sits in measures. */
const BOX = DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 });

/** Renders the avatar in a measured box, and returns it with its draw function. */
const setup = (look: Partial<ResolvedFeet> = {}, floor: typeof FLOOR | undefined = undefined) => {
  const drawRef: { current: DrawFeet | null } = { current: null };
  const { container } = render(
    <GameDataContext.Provider
      value={{ gameData: simpleGameData, gameId: "feet", resources: { boots: "/boots.png" }, expressions: new Map() }}
    >
      <div data-testid="box">
        <MouseFeetAvatar look={{ ...FEET_DEFAULTS, ...look }} floor={floor} drawRef={drawRef} />
      </div>
    </GameDataContext.Provider>,
  );
  const avatar = container.querySelector<HTMLElement>(".mouse-feet-avatar")!;
  vi.spyOn(avatar.parentElement!, "getBoundingClientRect").mockReturnValue(BOX);
  const draw: DrawFeet = (at) => act(() => drawRef.current?.(at));
  return { avatar, draw };
};

/** A size the avatar was given, in pixels. */
const px = (avatar: HTMLElement, property: string) => parseFloat(avatar.style.getPropertyValue(property));

describe("MouseFeetAvatar", () => {
  it("shows only while the pointer is over the game", () => {
    const { avatar, draw } = setup();
    expect(avatar.hidden).toBe(true);
    draw({ point: { x: 100, y: 200 }, airborne: false });
    expect(avatar.hidden).toBe(false);
    draw(null);
    expect(avatar.hidden).toBe(true);
  });

  it("stands at the pointer in a 2D scene, size % of the box's width across", () => {
    const { avatar, draw } = setup({ size: 10 });
    draw({ point: { x: 100, y: 200 }, airborne: false });
    expect([avatar.style.left, avatar.style.top]).toEqual(["100px", "200px"]);
    expect([px(avatar, "--feet-width"), px(avatar, "--feet-height")]).toEqual([100, 100]);
  });

  it("lies flat on a 2.5D floor, smaller and sorted behind at the back", () => {
    const { avatar, draw } = setup({ size: 10 }, FLOOR);
    const at = (y: number) => {
      const point = floorToViewport(FLOOR, { x: 50, y });
      draw({ point: { x: point.x * BOX.width, y: point.y * BOX.height }, airborne: false });
      return { width: px(avatar, "--feet-width"), height: px(avatar, "--feet-height"), z: Number(avatar.style.zIndex) };
    };
    const [front, back] = [at(90), at(10)];
    expect(front.height).toBeLessThan(front.width);
    expect(back.width).toBeLessThan(front.width);
    expect(back.z).toBeLessThan(front.z);
  });

  it("lifts mid-jump, with a shadow left on the floor", () => {
    const { avatar, draw } = setup();
    draw({ point: { x: 100, y: 200 }, airborne: true });
    expect(avatar.hasAttribute("data-airborne")).toBe(true);
    expect(avatar.querySelector(".mouse-feet-shadow")).not.toBeNull();
    draw({ point: { x: 100, y: 200 }, airborne: false });
    expect(avatar.hasAttribute("data-airborne")).toBe(false);
  });

  it("draws the footprint in its colour, or the image standing on it", () => {
    expect(setup({ color: "red" }).avatar.querySelector<HTMLElement>("div.mouse-feet-body")!.style.background).toBe(
      "red",
    );
    expect(setup({ imageResource: "boots" }).avatar.querySelector("img.mouse-feet-body")!.getAttribute("src")).toBe(
      "/boots.png",
    );
  });

  it("marks whether the pointer hides while it shows", () => {
    expect(setup().avatar.dataset.pointer).toBe("shown");
    expect(setup({ pointer: "hidden" }).avatar.dataset.pointer).toBe("hidden");
  });
});
