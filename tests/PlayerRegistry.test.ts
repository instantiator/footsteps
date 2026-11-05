import { describe, expect, it, vi } from "vitest";
import { PlayerRegistry } from "../src/components/camera/PlayerRegistry";
import { noKeyPoints, type VisionFrame, type VisionPerson } from "../src/vision/VisionTypes";

const WIDTH = 100;
const HEIGHT = 10;

/** Someone the tracker calls this id, whose silhouette is one pixel at this x. */
const person = (id: number, x = 50, extra: Partial<VisionPerson> = {}): VisionPerson => {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  mask[5 * WIDTH + x] = 1;
  return { id, mask, keyPoints: noKeyPoints(), scale: 1, ...extra };
};
const frame = (...people: VisionPerson[]): VisionFrame => ({ width: WIDTH, height: HEIGHT, timestamp: 0, people });
const idsIn = ({ people }: VisionFrame) => people.map(({ id }) => id);

/** A registry that has seen this tracker's people, with their player ids. */
const registryWith = (...people: VisionPerson[]) => {
  const registry = new PlayerRegistry();
  const { interactive } = registry.update(frame(...people));
  return { registry, ids: idsIn(interactive) };
};

describe("PlayerRegistry numbers", () => {
  it("gives each person the lowest free number, kept while they are tracked", () => {
    const { registry, ids } = registryWith(person(10), person(11));
    expect(ids.map((id) => registry.numberOf(id))).toEqual([1, 2]);
    registry.update(frame(person(11), person(10)));
    expect(ids.map((id) => registry.numberOf(id))).toEqual([1, 2]);
  });

  it("frees a number when its person goes, for the next to take", () => {
    const { registry, ids } = registryWith(person(10), person(11));
    registry.update(frame(person(11)));
    expect(registry.numberOf(ids[0])).toBeUndefined();
    const { interactive } = registry.update(frame(person(11), person(12)));
    expect(interactive.people.map(({ id }) => registry.numberOf(id)).sort()).toEqual([1, 2]);
  });

  it("finds a player by number", () => {
    const { registry, ids } = registryWith(person(10));
    expect(registry.idOf(1)).toBe(ids[0]);
    expect(registry.idOf(2)).toBeUndefined();
  });
});

describe("PlayerRegistry frames", () => {
  it("rewrites people's ids to a stable id", () => {
    const { registry, ids } = registryWith(person(10));
    const { drawn } = registry.update(frame(person(10, 60)));
    expect(idsIn(drawn)).toEqual(ids);
    expect(ids[0]).not.toBe(10);
  });

  it("keeps a held person interactive, as their monitor waits for them", () => {
    const { registry } = registryWith(person(10));
    const { interactive } = registry.update(frame(person(10, 50, { held: { opacity: 0.5 } })));
    expect(interactive.people[0].held).toEqual({ opacity: 0.5 });
  });

  it("takes a frozen player out of the interactive list, and keeps their image and depth", () => {
    const { registry, ids } = registryWith(person(10));
    registry.freeze(ids[0], "scope");
    const { interactive, drawn, frozenIds } = registry.update(frame(person(10, 90)));
    expect(interactive.people).toEqual([]);
    expect(drawn.people[0].held).toEqual({ opacity: 1 });
    expect(drawn.people[0].mask[5 * WIDTH + 50]).toBe(1); // where they were, not where they have moved to
    expect(frozenIds).toEqual(new Set(ids));
  });

  it("treats a leaving player the same way", () => {
    const { registry, ids } = registryWith(person(10));
    registry.startLeaving(ids[0], "scope");
    const { interactive, frozenIds, drawn } = registry.update(frame(person(10, 90)));
    expect(interactive.people).toEqual([]);
    expect(frozenIds.has(ids[0])).toBe(true);
    expect(drawn.people).toHaveLength(1);
  });

  it("doesn't draw a removed player, but keeps their canvas", () => {
    const { registry, ids } = registryWith(person(10));
    registry.startLeaving(ids[0], "scope");
    registry.finishLeaving(ids[0]);
    const { interactive, drawn, knownIds } = registry.update(frame(person(10)));
    expect(interactive.people).toEqual([]);
    expect(drawn.people).toEqual([]);
    expect(knownIds.has(ids[0])).toBe(true);
  });

  it("returns an unfrozen or restored player to the live camera", () => {
    const { registry, ids } = registryWith(person(10));
    registry.freeze(ids[0], "scope");
    registry.update(frame(person(10, 90)));
    registry.restore(ids[0]);
    const { interactive, frozenIds } = registry.update(frame(person(10, 90)));
    expect(idsIn(interactive)).toEqual(ids);
    expect(interactive.people[0].mask[5 * WIDTH + 90]).toBe(1);
    expect(frozenIds.size).toBe(0);
  });
});

describe("PlayerRegistry notes of lost players", () => {
  const removed = () => {
    const { registry, ids } = registryWith(person(10));
    registry.startLeaving(ids[0], "scope");
    registry.finishLeaving(ids[0]);
    return { registry, id: ids[0] };
  };

  it("lets a new person near a removed player's note inherit it, rather than coming back active", () => {
    const { registry, id } = removed();
    registry.update(frame());
    const { interactive } = registry.update(frame(person(20, 60)));
    expect(interactive.people).toEqual([]);
    expect(registry.stateOf(id)).toBe("removed");
    expect(registry.update(frame(person(20, 60))).interactive.people).toEqual([]);
  });

  it("makes a new person far from the note someone new", () => {
    const { registry, id } = removed();
    registry.update(frame());
    const { interactive } = registry.update(frame(person(20, 90)));
    expect(interactive.people).toHaveLength(1);
    expect(registry.numberOf(interactive.people[0].id)).toBe(2); // the note still holds number 1
    expect(registry.stateOf(id)).toBe("removed");
  });

  it("keeps a frozen player drawn after their track is lost, and the same player when inherited", () => {
    const { registry, ids } = registryWith(person(10));
    registry.freeze(ids[0], "scope");
    const lost = registry.update(frame());
    expect(idsIn(lost.drawn)).toEqual(ids);
    const found = registry.update(frame(person(20, 55)));
    expect(idsIn(found.drawn)).toEqual(ids);
    expect(found.interactive.people).toEqual([]);
    expect(registry.stateOf(ids[0])).toBe("frozen");
  });

  it("ends a leaving player whose track is lost as removed, and they don't come back active", () => {
    const { registry, ids } = registryWith(person(10));
    registry.startLeaving(ids[0], "scope");
    expect(idsIn(registry.update(frame()).drawn)).toEqual(ids);
    registry.finishLeaving(ids[0]);
    expect(registry.update(frame(person(20, 50))).interactive.people).toEqual([]);
    expect(registry.stateOf(ids[0])).toBe("removed");
  });

  it("drops a noted player when restored, as there's nobody to return", () => {
    const { registry, id } = removed();
    registry.update(frame());
    registry.restore(id);
    expect(registry.knownIds().has(id)).toBe(false);
    expect(registry.update(frame(person(20, 50))).interactive.people).toHaveLength(1);
  });

  it("keeps removed players across a new tracking loop, whose ids clash with the old ones", () => {
    const { registry, id } = removed();
    registry.resetTracking(WIDTH);
    // The new loop's person 10 is someone else, standing elsewhere
    const { interactive } = registry.update(frame(person(10, 90)));
    expect(interactive.people).toHaveLength(1);
    expect(interactive.people[0].id).not.toBe(id);
    expect(registry.stateOf(id)).toBe("removed");
  });

  it("forgets active players with a new tracking loop", () => {
    const { registry, ids } = registryWith(person(10));
    registry.resetTracking(WIDTH);
    expect(registry.knownIds().has(ids[0])).toBe(false);
  });
});

describe("PlayerRegistry counts", () => {
  const watched = (...people: VisionPerson[]) => {
    const registry = new PlayerRegistry();
    const onCounts = vi.fn();
    registry.onCounts(onCounts);
    const { interactive } = registry.update(frame(...people));
    return { registry, onCounts, ids: idsIn(interactive) };
  };

  it("counts someone in shot, including one the model has lost for a moment", () => {
    const { registry, onCounts } = watched(person(10));
    expect(onCounts).toHaveBeenLastCalledWith({ active: 1, removed: 0, frozen: 0 });
    onCounts.mockClear();
    registry.update(frame(person(10, 50, { held: { opacity: 0.5 } })));
    expect(onCounts).not.toHaveBeenCalled();
  });

  it("counts a leaving player as active until removed", () => {
    const { registry, onCounts, ids } = watched(person(10));
    onCounts.mockClear();
    registry.startLeaving(ids[0], "scope");
    expect(onCounts).not.toHaveBeenCalled();
    registry.finishLeaving(ids[0]);
    expect(onCounts).toHaveBeenLastCalledWith({ active: 0, removed: 1, frozen: 0 });
  });

  it("counts a frozen player as active too, until they start to leave", () => {
    const { registry, onCounts, ids } = watched(person(10));
    registry.freeze(ids[0], "scope");
    expect(onCounts).toHaveBeenLastCalledWith({ active: 1, removed: 0, frozen: 1 });
    registry.startLeaving(ids[0], "scope");
    expect(onCounts).toHaveBeenLastCalledWith({ active: 1, removed: 0, frozen: 0 });
  });

  it("reports only changes, not every frame", () => {
    const { registry, onCounts } = watched(person(10));
    onCounts.mockClear();
    for (let i = 0; i < 5; i++) registry.update(frame(person(10, 50 + i)));
    expect(onCounts).not.toHaveBeenCalled();
    registry.update(frame());
    expect(onCounts).toHaveBeenCalledExactlyOnceWith({ active: 0, removed: 0, frozen: 0 });
  });

  it("keeps counting a removed player whose track is lost", () => {
    const { registry, onCounts, ids } = watched(person(10));
    registry.startLeaving(ids[0], "scope");
    registry.finishLeaving(ids[0]);
    onCounts.mockClear();
    registry.update(frame());
    expect(onCounts).not.toHaveBeenCalled();
  });
});
