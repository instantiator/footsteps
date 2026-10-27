/** The vision models the game can track players with. */
export const VISION_MODELS = ["bodypix", "mediapipe", "movenet"] as const;

/** Application-level settings: set per environment in the `.env*` files, and overridable by URL query. */
export interface AppConfig {
  /** Shows debugging aids. */
  debug: boolean;
  /** Shows the camera tracking's frame rate in the HUD, while a camera is being tracked. */
  showFps: boolean;
  /** Which vision model tracks the players. */
  visionModel: (typeof VISION_MODELS)[number];
  /** The tfjs backend for tfjs models (BodyPix, MoveNet); WebGPU falls back to WebGL where unsupported. */
  visionBackend: "webgl" | "webgpu";
  /** Runs the vision model in a web worker, off the main thread. */
  visionWorker: boolean;
  /** The most players a model looks for. */
  visionMaxPeople: number;
  /** Smooths key points between frames, and keeps each player's id stable. */
  visionSmoothing: boolean;
  /** Frames a body part must stay over an element before the interaction counts. */
  visionStableFrames: number;
  /** The widest frame the model is given, in pixels; wider camera frames are scaled down first. 0 gives every frame at full size. */
  visionInputWidth: number;
  /** The camera resolution to ask for; the camera may give something else. */
  cameraWidth: number;
  /** See {@link AppConfig.cameraWidth}. */
  cameraHeight: number;
  /** How far the silhouette's edges fade out, in screen pixels of the camera canvas; 0 for hard edges. */
  cameraFeatherPx: number;
  /** How long, in milliseconds, a player the model loses for a moment is still shown where they were (needs smoothing). */
  cameraHoldMs: number;
  /** How long, in milliseconds, a held player then takes to fade out. */
  cameraFadeMs: number;
  /** Fills parts of a player the model missed for a frame (eg. their legs) from the frame before (needs smoothing). */
  cameraFillGaps: boolean;
  /** How far the feet must rise for a jump, as a fraction of the player's height. */
  jumpMinRise: number;
  /** How far the feet may wander while standing, as a fraction of the player's height. */
  jumpStill: number;
  /** How long the feet must be on the ground before a take-off counts, in milliseconds. */
  jumpMinGroundedMs: number;
  /** The longest the feet may still be rising after leaving the ground, in milliseconds. */
  jumpMaxRiseMs: number;
  /** The longest a jump may take from leaving the ground to landing, in milliseconds. */
  jumpMaxAirtimeMs: number;
  /** How much of the rise the feet must come back down to land (0–1). */
  jumpMinDescent: number;
  /** BodyPix's backbone: ResNet50 is more accurate, MobileNetV1 faster. */
  bodypixArchitecture: "ResNet50" | "MobileNetV1";
  /** BodyPix's output stride: smaller is finer and slower. ResNet50 has 16 and 32, MobileNetV1 8 and 16; else 16. */
  bodypixOutputStride: 8 | 16 | 32;
  /** Bytes per BodyPix weight: fewer is smaller and faster, at a little accuracy. */
  bodypixQuantBytes: 1 | 2 | 4;
  /** The resolution BodyPix scales each frame to before segmenting. */
  bodypixInternalResolution: "low" | "medium" | "high" | "full";
  /** How confident BodyPix must be (0–1) that a pixel is a person. */
  bodypixThreshold: number;
  /** How many passes BodyPix makes to assign pixels to people: fewer is faster, but may give one person's limb to another. */
  bodypixRefineSteps: number;
  /** MediaPipe Pose Landmarker's model size: lite is fastest, heavy most accurate. */
  mediapipeVariant: "lite" | "full" | "heavy";
}

/** The settings used when the environment does not give one. */
export const DEFAULT_APP_CONFIG: AppConfig = {
  debug: false,
  showFps: false,
  visionModel: "bodypix",
  visionBackend: "webgpu",
  visionWorker: true,
  visionMaxPeople: 4,
  visionSmoothing: true,
  visionStableFrames: 2,
  visionInputWidth: 960,
  cameraWidth: 1280,
  cameraHeight: 720,
  cameraFeatherPx: 3,
  cameraHoldMs: 400,
  cameraFadeMs: 300,
  cameraFillGaps: false,
  jumpMinRise: 0.04,
  jumpStill: 0.02,
  jumpMinGroundedMs: 100,
  jumpMaxRiseMs: 500,
  jumpMaxAirtimeMs: 1000,
  jumpMinDescent: 0.5,
  bodypixArchitecture: "MobileNetV1",
  bodypixOutputStride: 16,
  bodypixQuantBytes: 2,
  bodypixInternalResolution: "high",
  bodypixThreshold: 0.65,
  bodypixRefineSteps: 3,
  mediapipeVariant: "full",
};

/** Reads one setting from its text form, or gives undefined if the text is not a valid value. */
type Parser<T> = (raw: string) => T | undefined;

/** Any value but "false" is true, so `?debug` alone turns debugging on. */
const bool: Parser<boolean> = (raw) => raw !== "false";

/** A whole number of at least `min`. */
const int =
  (min: number): Parser<number> =>
  (raw) => {
    const value = Number(raw);
    return /^\d+$/.test(raw.trim()) && value >= min ? value : undefined;
  };

/** A number in the range [0, 1]. */
const fraction: Parser<number> = (raw) => {
  const value = Number(raw);
  return raw.trim() !== "" && value >= 0 && value <= 1 ? value : undefined;
};

/** One of the given values, compared as text. */
const oneOf =
  <T extends string | number>(...values: readonly T[]): Parser<T> =>
  (raw) =>
    values.find((value) => String(value) === raw);

/** How each setting is read. */
const PARSERS: { [K in keyof AppConfig]: Parser<AppConfig[K]> } = {
  debug: bool,
  showFps: bool,
  visionModel: oneOf(...VISION_MODELS),
  visionBackend: oneOf("webgl", "webgpu"),
  visionWorker: bool,
  visionMaxPeople: int(1),
  visionSmoothing: bool,
  visionStableFrames: int(1),
  visionInputWidth: int(0),
  cameraWidth: int(1),
  cameraHeight: int(1),
  cameraFeatherPx: int(0),
  cameraHoldMs: int(0),
  cameraFadeMs: int(0),
  cameraFillGaps: bool,
  jumpMinRise: fraction,
  jumpStill: fraction,
  jumpMinGroundedMs: int(0),
  jumpMaxRiseMs: int(0),
  jumpMaxAirtimeMs: int(0),
  jumpMinDescent: fraction,
  bodypixArchitecture: oneOf("ResNet50", "MobileNetV1"),
  bodypixOutputStride: oneOf(8, 16, 32),
  bodypixQuantBytes: oneOf(1, 2, 4),
  bodypixInternalResolution: oneOf("low", "medium", "high", "full"),
  bodypixThreshold: fraction,
  bodypixRefineSteps: int(1),
  mediapipeVariant: oneOf("lite", "full", "heavy"),
};

/** Every setting's name. */
const KEYS = Object.keys(PARSERS) as (keyof AppConfig)[];

/** The environment variable for a setting: `visionModel` is `VITE_VISION_MODEL`. */
export const envKey = (key: keyof AppConfig): string => `VITE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;

/** Sets one value from its text form; an invalid one warns and leaves the setting as it was. */
const applyRaw = <K extends keyof AppConfig>(config: AppConfig, key: K, raw: string, name: string): void => {
  const value = PARSERS[key](raw);
  if (value === undefined) console.warn(`Ignoring invalid config ${name}=${raw}; keeping ${String(config[key])}`);
  else config[key] = value;
};

/**
 * Layers settings from text over a base config.
 * @param read gives a setting's text and the name it was found under, or undefined when it is not set
 */
const layer = (base: AppConfig, read: (key: keyof AppConfig) => [raw: string, name: string] | undefined): AppConfig => {
  const config = { ...base };
  for (const key of KEYS) {
    const found = read(key);
    if (found) applyRaw(config, key, found[0], found[1]);
  }
  return config;
};

/** Layers `VITE_*` environment variables (eg. `import.meta.env`) over a base config. */
export const configFromEnv = (env: Record<string, unknown>, base: AppConfig = DEFAULT_APP_CONFIG): AppConfig =>
  layer(base, (key) => {
    const raw = env[envKey(key)];
    return typeof raw === "string" ? [raw, envKey(key)] : undefined;
  });

/** Layers URL query parameters named after the settings (eg. `?visionModel=mediapipe`) over a base config. */
export const configFromQuery = (params: URLSearchParams, base: AppConfig): AppConfig =>
  layer(base, (key) => {
    const raw = params.get(key);
    return raw === null ? undefined : [raw, `?${key}`];
  });

/** The config for this build's environment, from the `.env*` files Vite loaded. */
export const ENV_APP_CONFIG: AppConfig = configFromEnv(import.meta.env);
