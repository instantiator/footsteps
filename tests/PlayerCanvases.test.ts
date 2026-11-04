import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerCanvases, type PlayerCanvas } from "../src/components/camera/PlayerCanvases";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const person = (id: number): VisionPerson => ({ id, mask: new Uint8Array(1), keyPoints: noKeyPoints(), scale: 1 });
const frame = (...people: VisionPerson[]): VisionFrame => ({ width: 1, height: 1, timestamp: 0, people });

describe("PlayerCanvases", () => {
  let container: HTMLElement;
  let reference: HTMLCanvasElement;
  let canvases: PlayerCanvases;
  const drawn = new Map<number, PlayerCanvas>();
  const draw = vi.fn((player: PlayerCanvas, playerFrame: VisionFrame) => {
    const [drawnPerson] = playerFrame.people;
    if (drawnPerson !== undefined) drawn.set(drawnPerson.id, player);
  });
  const wrappers = () => Array.from(container.querySelectorAll<HTMLElement>(".player"));

  beforeEach(() => {
    draw.mockClear();
    drawn.clear();
    container = document.createElement("div");
    reference = container.appendChild(document.createElement("canvas"));
    Object.assign(reference, { width: 640, height: 480, className: "silhouette" });
    reference.style.transform = "scaleX(-1)";
    reference.style.zIndex = "-1000";
    canvases = new PlayerCanvases(reference);
  });

  it("draws each player alone, on a canvas of their own, never the reference", () => {
    canvases.draw(frame(person(1), person(2)), draw);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenCalledWith(drawn.get(1), frame(person(1)));
    expect(draw).toHaveBeenCalledWith(drawn.get(2), frame(person(2)));
    expect(drawn.get(1)?.canvas).not.toBe(drawn.get(2)?.canvas);
    expect(drawn.get(1)?.canvas).not.toBe(reference);
  });

  it("makes canvases the reference's size and mirroring, with the mirroring on the canvas alone", () => {
    canvases.draw(frame(person(1)), draw);
    const { wrapper, canvas } = drawn.get(1)!;
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(canvas.style.transform).toBe("scaleX(-1)");
    expect(wrapper.style.transform).toBe("");
    expect(wrapper).toHaveClass("player", "silhouette");
    expect(wrapper.style.zIndex).toBe("-1000");
  });

  it("keeps each player's own canvas when their order changes", () => {
    canvases.draw(frame(person(1), person(2)), draw);
    const [one, two] = [drawn.get(1), drawn.get(2)];
    canvases.draw(frame(person(2), person(1)), draw);
    expect(drawn.get(1)).toBe(one);
    expect(drawn.get(2)).toBe(two);
  });

  it("doesn't give a new player what is on another's wrapper", () => {
    canvases.draw(frame(person(1)), draw);
    const { wrapper } = drawn.get(1)!;
    wrapper.style.transformOrigin = "10% 10%";
    wrapper.style.zIndex = "5";
    canvases.draw(frame(person(1), person(2)), draw);
    expect(drawn.get(2)?.wrapper.style.transformOrigin).toBe("");
    expect(drawn.get(2)?.wrapper.style.zIndex).toBe("-1000");
  });

  it("removes a player's canvas when they leave", () => {
    canvases.draw(frame(person(1), person(2), person(3)), draw);
    expect(wrappers()).toHaveLength(3);
    canvases.draw(frame(person(2)), draw);
    expect(wrappers()).toEqual([drawn.get(2)?.wrapper]);
  });

  it("clears the reference when nobody is there, so a frame still draws", () => {
    canvases.draw(frame(), draw);
    expect(draw).toHaveBeenCalledExactlyOnceWith({ wrapper: reference, canvas: reference }, frame());
  });

  it("removes every player's canvas on request, leaving the reference", () => {
    canvases.draw(frame(person(1), person(2)), draw);
    canvases.removeAll();
    expect(wrappers()).toEqual([]);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("follows the reference's size", () => {
    canvases.draw(frame(person(1)), draw);
    Object.assign(reference, { width: 320, height: 240 });
    canvases.resize();
    expect(drawn.get(1)?.canvas.width).toBe(320);
  });
});
