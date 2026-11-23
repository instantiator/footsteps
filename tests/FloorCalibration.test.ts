import { afterEach, describe, expect, it } from "vitest";
import {
  calibrationOrDefault,
  cameraKeyOf,
  forgetAllCalibrations,
  forgetCalibration,
  isCalibrated,
  loadCalibration,
  loadFloorSize,
  saveCalibration,
  saveFloorSize,
} from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS, type Corners } from "../src/components/camera/FloorGeometry";

const KEY = "footsteps:floor-calibrations";
const OLD_KEY = "footsteps:floor-calibration";

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

  it("keys each camera and size, the system default camera as default, at the configured size unless chosen", () => {
    expect(cameraKeyOf({})).toBe("default@1280x720");
    expect(cameraKeyOf({ deviceId: "laptop", size: { width: 640, height: 480 } })).toBe("laptop@640x480");
  });

  it("keeps one camera's sizes apart", () => {
    const hd = cameraKeyOf({ deviceId: "lifecam", size: { width: 1280, height: 720 } });
    const sd = cameraKeyOf({ deviceId: "lifecam", size: { width: 640, height: 480 } });
    saveCalibration(hd, NARROW);
    expect(isCalibrated(sd)).toBe(false);
    saveCalibration(sd, DEFAULT_CORNERS);
    expect(loadCalibration(hd)).toEqual(NARROW);
  });

  it("forgets one configuration's corners only", () => {
    saveCalibration("laptop", NARROW);
    saveCalibration("rear", NARROW);
    forgetCalibration("laptop");
    expect(isCalibrated("laptop")).toBe(false);
    expect(isCalibrated("rear")).toBe(true);
  });

  it("drops calibrations saved before they were per configuration", () => {
    localStorage.setItem(OLD_KEY, JSON.stringify({ default: NARROW }));
    expect(isCalibrated(cameraKeyOf({}))).toBe(false);
    expect(localStorage.getItem(OLD_KEY)).toBeNull();
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

  it("keeps each camera's measured floor size, forgetting it with the corners", () => {
    saveFloorSize("laptop", { width: 3, depth: 2.5 });
    saveFloorSize("rear", { width: 4, depth: 3 });
    expect(loadFloorSize("laptop")).toEqual({ width: 3, depth: 2.5 });

    saveFloorSize("laptop", undefined);
    expect(loadFloorSize("laptop")).toBeUndefined();
    forgetCalibration("rear");
    expect(loadFloorSize("rear")).toBeUndefined();

    saveFloorSize("laptop", { width: 3, depth: 2.5 });
    forgetAllCalibrations();
    expect(loadFloorSize("laptop")).toBeUndefined();
  });

  it("ignores stored floor sizes that are corrupt or out of range", () => {
    localStorage.setItem("footsteps:floor-sizes", JSON.stringify({ tiny: { width: 0.1, depth: 2 }, text: "3x2" }));
    expect(loadFloorSize("tiny")).toBeUndefined();
    expect(loadFloorSize("text")).toBeUndefined();
  });
});
