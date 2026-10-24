import { useEffect, useState, type CSSProperties } from "react";

/** The parts of the Battery Status API used here. TypeScript's DOM types leave it out, as only Chromium has it. */
interface BatteryManager extends EventTarget {
  /** Whether the device is charging. */
  readonly charging: boolean;
  /** The charge, from 0 to 1. */
  readonly level: number;
}

/** A navigator that may offer the Battery Status API. */
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManager> };

/** The charge at or below which an unplugged device gets the warning. */
const LOW_BATTERY_LEVEL = 0.2;

/** Fixed above everything, high contrast, and out of the way of clicks. */
const WARNING_STYLE: CSSProperties = {
  position: "fixed",
  top: "8px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1000,
  padding: "6px 12px",
  borderRadius: "6px",
  background: "#b00020",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
  fontWeight: "bold",
  pointerEvents: "none",
};

/** The battery's charge while it is low and unplugged, or undefined; updates as it changes. */
function useLowBattery(): number | undefined {
  const [lowLevel, setLowLevel] = useState<number>();

  useEffect(() => {
    const nav: NavigatorWithBattery = navigator;
    if (!nav.getBattery) return; // only Chromium browsers report the battery

    let battery: BatteryManager | undefined;
    let cancelled = false;
    const update = () => {
      if (!battery) return;
      setLowLevel(!battery.charging && battery.level <= LOW_BATTERY_LEVEL ? battery.level : undefined);
    };
    nav
      .getBattery()
      .then((manager) => {
        if (cancelled) return;
        battery = manager;
        update();
        manager.addEventListener("levelchange", update);
        manager.addEventListener("chargingchange", update);
      })
      .catch((error: unknown) => console.warn("Could not read the battery level:", error));
    return () => {
      cancelled = true;
      battery?.removeEventListener("levelchange", update);
      battery?.removeEventListener("chargingchange", update);
    };
  }, []);

  return lowLevel;
}

/** Warns, on every page, when the battery is low and the device isn't charging, so a game isn't cut short. */
export default function BatteryWarning() {
  const level = useLowBattery();
  if (level === undefined) return null;
  return <output style={WARNING_STYLE}>Battery low ({Math.round(level * 100)}%). Plug in to keep playing.</output>;
}
