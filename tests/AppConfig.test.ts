import { afterEach, describe, expect, it, vi } from "vitest";
import { configFromEnv, configFromQuery, DEFAULT_APP_CONFIG, ENV_APP_CONFIG, envKey } from "../src/config/AppConfig";

afterEach(() => vi.restoreAllMocks());

describe("envKey", () => {
  it("names each setting's VITE_ variable in upper snake case", () => {
    expect(envKey("debug")).toBe("VITE_DEBUG");
    expect(envKey("bodypixOutputStride")).toBe("VITE_BODYPIX_OUTPUT_STRIDE");
  });
});

describe("configFromEnv", () => {
  it("keeps the defaults when nothing is set", () => {
    expect(configFromEnv({})).toEqual(DEFAULT_APP_CONFIG);
  });

  it.each([
    ["a boolean", "VITE_DEBUG", "true", { debug: true }],
    ["a boolean's false", "VITE_VISION_SMOOTHING", "false", { visionSmoothing: false }],
    ["a whole number", "VITE_VISION_MAX_PEOPLE", "6", { visionMaxPeople: 6 }],
    ["a fraction", "VITE_BODYPIX_THRESHOLD", "0.5", { bodypixThreshold: 0.5 }],
    ["a named choice", "VITE_VISION_MODEL", "mediapipe", { visionModel: "mediapipe" }],
    ["a numeric choice", "VITE_BODYPIX_OUTPUT_STRIDE", "32", { bodypixOutputStride: 32 }],
  ])("reads %s", (_kind, name, raw, expected) => {
    expect(configFromEnv({ [name]: raw })).toEqual({ ...DEFAULT_APP_CONFIG, ...expected });
  });

  it.each([
    ["VITE_VISION_MAX_PEOPLE", "0"],
    ["VITE_VISION_MAX_PEOPLE", "2.5"],
    ["VITE_CAMERA_WIDTH", "wide"],
    ["VITE_BODYPIX_THRESHOLD", "1.5"],
    ["VITE_BODYPIX_THRESHOLD", ""],
    ["VITE_VISION_MODEL", "posenet"],
    ["VITE_BODYPIX_QUANT_BYTES", "3"],
  ])("warns about %s=%s and keeps the default", (name, raw) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(configFromEnv({ [name]: raw })).toEqual(DEFAULT_APP_CONFIG);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`${name}=${raw}`));
  });

  it("ignores variables that are not settings, and values that are not text", () => {
    expect(configFromEnv({ VITE_OTHER: "1", BASE_URL: "/", VITE_DEBUG: true })).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe("configFromQuery", () => {
  const base = { ...DEFAULT_APP_CONFIG, visionModel: "movenet" as const };

  it("overrides the base with settings named in camel case", () => {
    const params = new URLSearchParams("visionModel=mediapipe&debug");
    expect(configFromQuery(params, base)).toEqual({ ...base, visionModel: "mediapipe", debug: true });
  });

  it("ignores parameters that are not settings, and env-style names", () => {
    expect(configFromQuery(new URLSearchParams("other=1&VITE_DEBUG=true"), base)).toEqual(base);
  });

  it("warns about an invalid value and keeps the base's", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(configFromQuery(new URLSearchParams("visionModel=nope"), base)).toEqual(base);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("?visionModel=nope"));
  });
});

describe("ENV_APP_CONFIG", () => {
  it("is read from the committed .env files, with .env.test's overrides", () => {
    expect(ENV_APP_CONFIG.visionWorker).toBe(false);
    expect(ENV_APP_CONFIG.visionModel).toBe("bodypix");
  });
});
