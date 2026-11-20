/** Where a webcam configuration's diagonal field of view comes from. */
export type FovSource = "published" | "estimated" | "measured";

/** One way a known webcam can be opened: a picture size, with what it sees. One row per configuration. */
export interface WebcamConfig {
  /** The product's name. */
  camera: string;
  /** Who makes it. */
  manufacturer: string;
  /** A spec sheet on the web, where one is known. */
  specUrl?: string;
  /** Matches the label the browser gives the camera. */
  labelPattern: RegExp;
  /** A short name that tells this configuration apart from the camera's others. */
  configuration: string;
  /** The picture's width, in pixels. */
  width: number;
  /** The picture's height, in pixels. */
  height: number;
  /** The diagonal field of view in degrees, when known. */
  diagonalFov?: number;
  /** Where `diagonalFov` comes from. */
  fovSource?: FovSource;
  /** How it connects, such as "USB-A" or "built-in". */
  connections: string[];
  /** Whether it runs on a battery of its own, and for how long. */
  battery: string;
}

const LIFECAM_HD_3000 = {
  camera: "LifeCam HD-3000",
  manufacturer: "Microsoft",
  specUrl: "https://www.farnell.com/datasheets/1728895.pdf",
  labelPattern: /LifeCam HD-3000/i,
  connections: ["USB-A"],
  battery: "No",
};

const MACBOOK_PRO_M1_2020 = {
  camera: "MacBook Pro 13-inch (M1, 2020) FaceTime HD camera",
  manufacturer: "Apple",
  specUrl: "https://support.apple.com/kb/SP824",
  // ponytail: other Macs' cameras share this label, so they get these rows too; tighten it when one differs
  labelPattern: /FaceTime HD Camera/i,
  connections: ["Built-in"],
  battery: "No (uses the laptop's)",
};

/**
 * The webcams whose configurations are known. `docs/webcams.md` is generated from this list, so edit it here: the
 * pre-commit hook regenerates the doc.
 */
export const WEBCAMS: readonly WebcamConfig[] = [
  {
    ...LIFECAM_HD_3000,
    configuration: "HD",
    width: 1280,
    height: 720,
    diagonalFov: 68.5,
    fovSource: "published",
  },
  // The sensor is 16:9, so a 4:3 picture is taken as its middle, keeping its full height
  {
    ...LIFECAM_HD_3000,
    configuration: "SD",
    width: 640,
    height: 480,
    diagonalFov: 58,
    fovSource: "estimated",
  },
  // Measured on /setup: 0.608 m of wall across at 0.55 m, which is 64.8° diagonally in 16:9
  {
    ...MACBOOK_PRO_M1_2020,
    configuration: "HD",
    width: 1280,
    height: 720,
    diagonalFov: 65,
    fovSource: "measured",
  },
];

/** The known configurations of the camera with this label, if it's one we know. */
export const webcamConfigsFor = (label: string): WebcamConfig[] =>
  WEBCAMS.filter(({ labelPattern }) => labelPattern.test(label));

/** A picture size the landing page offers for a camera, named where the camera is known. */
export interface CameraOption {
  /** What the player sees, such as "HD (1280×720)". */
  name: string;
  /** Across, in pixels. */
  width: number;
  /** Down, in pixels. */
  height: number;
}

/** The sizes offered for a camera that isn't known, where it can give them. */
const PRESETS = [
  { width: 1280, height: 720 },
  { width: 640, height: 480 },
];

/**
 * The sizes to offer for a camera: a known camera's configurations, or else the presets it is big enough for.
 * @param largest the camera's largest picture, if the browser says
 */
export const cameraOptionsFor = (label: string, largest?: { width?: number; height?: number }): CameraOption[] => {
  const known = webcamConfigsFor(label);
  if (known.length > 0) {
    return known.map(({ configuration, width, height }) => ({
      name: `${configuration} (${width}×${height})`,
      width,
      height,
    }));
  }
  return PRESETS.filter(
    ({ width, height }) => width <= (largest?.width ?? Infinity) && height <= (largest?.height ?? Infinity),
  ).map((size) => ({ name: `${size.width}×${size.height}`, ...size }));
};

/**
 * The known configuration of the camera with this label: the one at `size` if given, else the first.
 * @returns undefined for a camera that isn't known, or isn't known at that size
 */
export const webcamFor = (label: string, size?: { width: number; height: number }): WebcamConfig | undefined => {
  const known = webcamConfigsFor(label);
  return size ? known.find(({ width, height }) => width === size.width && height === size.height) : known[0];
};
