import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BatteryWarning from "../src/components/core/BatteryWarning";

/** A battery stand-in for jsdom, which has no Battery Status API; `set` changes it as a device would. */
class FakeBattery extends EventTarget {
  charging: boolean;
  level: number;

  constructor(level: number, charging: boolean) {
    super();
    this.level = level;
    this.charging = charging;
  }

  set(level: number, charging: boolean) {
    this.level = level;
    this.charging = charging;
    this.dispatchEvent(new Event("levelchange"));
    this.dispatchEvent(new Event("chargingchange"));
  }
}

/** Gives `navigator` a `getBattery` that resolves the battery. */
const stubBattery = (battery: FakeBattery) =>
  Object.defineProperty(navigator, "getBattery", { configurable: true, value: async () => battery });

afterEach(() => {
  Reflect.deleteProperty(navigator, "getBattery");
});

describe("BatteryWarning", () => {
  it("warns when the battery is low and not charging", async () => {
    stubBattery(new FakeBattery(0.15, false));
    render(<BatteryWarning />);

    expect(await screen.findByRole("status")).toHaveTextContent("Battery low (15%)");
  });

  it.each([
    ["charging", 0.15, true],
    ["above the threshold", 0.5, false],
  ])("says nothing while %s", async (_case, level, charging) => {
    stubBattery(new FakeBattery(level, charging));
    render(<BatteryWarning />);

    await act(async () => undefined);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("follows the battery as it drains and is plugged in", async () => {
    const battery = new FakeBattery(0.5, false);
    stubBattery(battery);
    render(<BatteryWarning />);
    await act(async () => undefined);

    act(() => battery.set(0.2, false));
    expect(screen.getByRole("status")).toHaveTextContent("Battery low (20%)");

    act(() => battery.set(0.2, true));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says nothing when the browser can't report the battery", async () => {
    render(<BatteryWarning />);

    await act(async () => undefined);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns in the console, and shows nothing, when the battery can't be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "getBattery", {
      configurable: true,
      value: async () => {
        throw new DOMException("blocked by policy", "NotAllowedError");
      },
    });
    render(<BatteryWarning />);

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
    warn.mockRestore();
  });
});
