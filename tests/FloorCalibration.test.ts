import { afterEach, describe, expect, it } from "vitest";
import {
  calibrationOrDefault,
  cameraKeyOf,
  forgetAllCalibrations,
  isCalibrated,
  loadCalibration,
  saveCalibration,
} from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS, type Corners } from "../src/components/camera/FloorGeometry";

const KEY = "footsteps:floor-calibration";

const NARROW: Corners = { ...DEFAULT_CORNERS, frontLeft: { x: 0.2, y: 0.85 }, frontRight: { x: 0.8, y: 0.85 } };

afterEach(() => localStorage.clear());

describe("floor calibration storage", () => {
  it("saves and loads each camera's corners separately", () => {
    saveCalibration("laptop", NARROW);
    saveCalibration("rear", DEFAULT_CORNERS);
    expect(loadCalibration("laptop")).toEqual(NARROW);
    expect(loadCalibration("rear")).toEqual(DEFAULT_CORNERS);
    expect(isCalibrated("other")).toBe(false);
  });

  it("keys the system default camera as default", () => {
    expect(cameraKeyOf({})).toBe("default");
    expect(cameraKeyOf({ deviceId: "laptop" })).toBe("laptop");
  });

  it("falls back to the default corners for a camera never calibrated", () => {
    expect(calibrationOrDefault("laptop")).toEqual(DEFAULT_CORNERS);
    saveCalibration("laptop", NARROW);
    expect(calibrationOrDefault("laptop")).toEqual(NARROW);
  });

  it("forgets every camera's corners", () => {
    saveCalibration("laptop", NARROW);
    saveCalibration("rear", NARROW);
    forgetAllCalibrations();
    expect(isCalibrated("laptop")).toBe(false);
    expect(isCalibrated("rear")).toBe(false);
  });

  it("ignores stored corners that are corrupt, malformed or not a floor", () => {
    localStorage.setItem(KEY, "not json");
    expect(loadCalibration("laptop")).toBeUndefined();
    const { backLeft, backRight, frontRight, frontLeft } = DEFAULT_CORNERS;
    const swapped = { backLeft: frontLeft, backRight: frontRight, frontRight: backRight, frontLeft: backLeft };
    localStorage.setItem(KEY, JSON.stringify({ laptop: { backLeft: { x: "0" } }, rear: swapped, ok: NARROW }));
    expect(loadCalibration("laptop")).toBeUndefined();
    expect(loadCalibration("rear")).toBeUndefined();
    expect(loadCalibration("ok")).toEqual(NARROW);
  });
});
