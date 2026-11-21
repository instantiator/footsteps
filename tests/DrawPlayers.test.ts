import { afterEach, describe, expect, it, vi } from "vitest";
import { drawPlayers, spectatorStrength, type DrawnSpectators } from "../src/components/camera/DrawPlayers";
import { PlayerCanvases } from "../src/components/camera/PlayerCanvases";
import { PlayerRegistry } from "../src/components/camera/PlayerRegistry";
import type { GameSpectatorsData } from "../src/entities/data/scenes/GameSpectatorsData";
import { noKeyPoints, type VisionFrame } from "../src/vision/VisionTypes";

const frame: VisionFrame = {
  width: 2,
  height: 2,
  timestamp: 0,
  people: [{ id: 7, mask: new Uint8Array([0, 0, 1, 1]), keyPoints: noKeyPoints(), scale: 1 }],
};

/** Draws one player, a spectator 20 floor units off the floor, with these settings; returns their wrapper. */
const drawSpectator = (settings: GameSpectatorsData, { debugging = false, spectator = true } = {}) => {
  const reference = document.createElement("canvas");
  document.body.append(reference);
  const canvases = new PlayerCanvases(reference);
  const players = new PlayerRegistry();
  const id = players.update(frame).drawn.people[0].id;
  const drawn = { ...frame, people: [{ ...frame.people[0], id }] };
  const spectators: DrawnSpectators = {
    report: {
      spectators: new Set(spectator ? [id] : []),
      distances: new Map([[id, 20]]),
      returned: [],
      pendingMs: new Map(),
    },
    settings,
    margin: 5,
  };
  const draw = () =>
    drawPlayers(
      document.createElement("video"),
      { interactive: drawn, drawn, frozenIds: new Set(), knownIds: new Set([id]) },
      { canvases, positions: new Map(), sorted: false, players, spectators },
      { maskType: debugging ? "colored" : "binary", featherPx: 0 },
    );
  draw();
  return { wrapper: canvases.wrapperOf(id)!, spectators, draw };
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("spectatorStrength", () => {
  it("is full without a fade, and eases from the fade's start, the margin by default, to its end", () => {
    expect(spectatorStrength(0, undefined, 5)).toBe(1);
    expect(spectatorStrength(5, { to: 25 }, 5)).toBe(0);
    expect(spectatorStrength(15, { to: 25 }, 5)).toBe(0.5);
    expect(spectatorStrength(10, { to: 25 }, 5)).toBeCloseTo(0.156, 3);
    expect(spectatorStrength(30, { from: 10, to: 20 }, 5)).toBe(1);
  });
});

describe("drawPlayers spectators", () => {
  it("hides spectators by default", () => {
    expect(drawSpectator({}).wrapper.hidden).toBe(true);
  });

  it("gives a shown spectator their look at the strength their distance gives", () => {
    const { wrapper } = drawSpectator({
      show: "shown",
      look: { opacity: 0.2, filter: "grayscale(var(--spectator-strength))" },
      fade: { to: 35 },
    });
    expect(wrapper.hidden).toBe(false);
    expect(wrapper.dataset.spectator).toBe("");
    expect(wrapper.style.getPropertyValue("--spectator-strength")).toBe("0.5");
    expect(wrapper.style.opacity).toBe("0.6");
    expect(wrapper.style.filter).toBe("grayscale(var(--spectator-strength))");
  });

  it("takes the look off a spectator who plays again", () => {
    const { wrapper, spectators, draw } = drawSpectator({ show: "shown", look: { opacity: 0.2 } });
    spectators.report = { ...spectators.report, spectators: new Set() };
    draw();
    expect(wrapper.dataset.spectator).toBeUndefined();
    expect(wrapper.style.opacity).toBe("");
  });

  it("draws spectators like anyone else when debugging", () => {
    const { wrapper } = drawSpectator({ show: "shown", look: { opacity: 0.2 } }, { debugging: true });
    expect(wrapper.hidden).toBe(false);
    expect(wrapper.dataset.spectator).toBeUndefined();
    expect(drawSpectator({}, { debugging: true }).wrapper.hidden).toBe(false);
  });
});
