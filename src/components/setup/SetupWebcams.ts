import { sizeOf, type CameraSize } from "../camera/CameraChoice";
import { WEBCAMS, webcamFor, type WebcamConfig } from "../camera/Webcams";
import { DEFAULT_SETUP_INPUTS } from "./SetupCalculations";

/** A camera the planner can fill in the field of view and picture shape for. */
export interface SetupWebcam {
  /** What the dropdown shows. */
  name: string;
  /** The diagonal field of view in degrees, when known. */
  diagonalFov?: number;
  /** The picture's width ÷ height. */
  aspect: number;
}

/** The fallback when the camera isn't known: the planner's own defaults. */
export const GENERIC_WEBCAM: SetupWebcam = {
  name: "Generic webcam",
  diagonalFov: DEFAULT_SETUP_INPUTS.diagonalFov,
  aspect: DEFAULT_SETUP_INPUTS.aspect,
};

const setupWebcamOf = ({ manufacturer, camera, configuration, width, height, diagonalFov }: WebcamConfig) => ({
  name: `${manufacturer} ${camera} · ${configuration} ${width}×${height}`,
  diagonalFov,
  aspect: width / height,
});

/** The cameras the planner offers: the generic one first, then every known webcam's configurations. */
export const SETUP_WEBCAMS: readonly SetupWebcam[] = [GENERIC_WEBCAM, ...WEBCAMS.map(setupWebcamOf)];

/** The planner's entry for a known configuration, or the generic one. */
const entryFor = (config: WebcamConfig | undefined): SetupWebcam =>
  config ? SETUP_WEBCAMS[WEBCAMS.indexOf(config) + 1] : GENERIC_WEBCAM;

/** A `WIDTHxHEIGHT` size from the query string, if it is one. */
const sizeFrom = (text: string | null): CameraSize | undefined => {
  const [width, height] = (text ?? "").split("x").map(Number);
  return width > 0 && height > 0 ? { width, height } : undefined;
};

/**
 * The camera to start planning with: the one the game uses, when the landing page names it in the query string
 * (`camera`, its label, and `size`); otherwise the browser's default camera, at the configured size; otherwise the
 * generic webcam. The browser only names its cameras once the camera has been granted.
 */
export const startingWebcam = async (query: URLSearchParams): Promise<SetupWebcam> => {
  const label = query.get("camera");
  if (label) return entryFor(webcamFor(label, sizeFrom(query.get("size"))));
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return GENERIC_WEBCAM;
  const first = (await navigator.mediaDevices.enumerateDevices()).find(({ kind }) => kind === "videoinput");
  return first?.label ? entryFor(webcamFor(first.label, sizeOf({})) ?? webcamFor(first.label)) : GENERIC_WEBCAM;
};
