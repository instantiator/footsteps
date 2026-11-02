import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerCanvases } from "../src/components/camera/PlayerCanvases";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const person = (id: number): VisionPerson => ({ id, mask: new Uint8Array(1), keyPoints: noKeyPoints(), scale: 1 });
const frame = (...people: VisionPerson[]): VisionFrame => ({ width: 1, height: 1, timestamp: 0, people });

describe("PlayerCanvases", () => {
  let container: HTMLElement;
  let first: HTMLCanvasElement;
  let canvases: PlayerCanvases;
  const draw = vi.fn();
  const inPage = () => Array.from(container.querySelectorAll("canvas"));

  beforeEach(() => {
    draw.mockClear();
    container = document.createElement("div");
    first = container.appendChild(document.createElement("canvas"));
    Object.assign(first, { width: 640, height: 480, className: "silhouette" });
    first.style.transform = "scaleX(-1)";
    canvases = new PlayerCanvases(first);
  });

  it("draws one player on the canvas it was given, adding nothing", () => {
    expect(canvases.draw(frame(person(7)), draw)).toEqual([first]);
    expect(inPage()).toEqual([first]);
    expect(draw).toHaveBeenCalledExactlyOnceWith(first, frame(person(7)));
  });

  it("draws each player alone, on a canvas of their own that looks like the first", () => {
    const [own, other] = canvases.draw(frame(person(1), person(2)), draw);

    expect(own).toBe(first);
    expect(other).not.toBe(first);
    expect(draw).toHaveBeenCalledWith(first, frame(person(1)));
    expect(draw).toHaveBeenCalledWith(other, frame(person(2)));
    expect(other.className).toBe("silhouette");
    expect(other.style.transform).toBe("scaleX(-1)");
    expect([other.width, other.height]).toEqual([640, 480]);
  });

  it("removes a player's canvas when they leave", () => {
    canvases.draw(frame(person(1), person(2), person(3)), draw);
    expect(inPage()).toHaveLength(3);

    canvases.draw(frame(person(1)), draw);
    expect(inPage()).toEqual([first]);
  });

  it("clears the first canvas when nobody is there, and has no player's canvas to return", () => {
    canvases.draw(frame(person(1), person(2)), draw);
    draw.mockClear();

    expect(canvases.draw(frame(), draw)).toEqual([]);

    expect(draw).toHaveBeenCalledExactlyOnceWith(first, frame());
    expect(inPage()).toEqual([first]);
  });

  it("removes every extra canvas on request", () => {
    canvases.draw(frame(person(1), person(2)), draw);
    canvases.removeExtras();
    expect(inPage()).toEqual([first]);
  });
});
