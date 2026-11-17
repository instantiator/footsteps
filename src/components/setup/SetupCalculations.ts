/**
 * Planning calculations for a play space: given a room, its players and a webcam, where to put the camera and how big
 * a floor to mark. `docs/prompts/002.04.01.plan - calculations.md` gives each step. Lengths are in metres and angles
 * in degrees. Angles become slopes (tangents) as they come in and go back to degrees as they go out; everything in
 * between is arithmetic and square roots.
 */

/** What the user knows about their space, players and camera. */
export interface SetupInputs {
  /** From the wall behind the camera to the far wall. */
  roomLength: number;
  /** From wall to wall, across the camera's view. */
  roomWidth: number;
  /** Optional: only lowers the highest camera position. */
  ceiling?: number;
  /** Space needed above the camera. */
  clearance: number;
  /** The shortest player's height, which caps the floor's size so they don't look tiny. */
  shortestPlayer: number;
  /** The tallest player's height, who must fit head to toe at the front and back. */
  tallestPlayer: number;
  /** Minimum space taken to the floor's left, from the camera's view. */
  marginLeft: number;
  /** Minimum space taken to the floor's right, from the camera's view. */
  marginRight: number;
  /** Minimum space taken beyond the floor's far edge. */
  marginFar: number;
  /** Minimum space behind the camera, where the player's screen stands. */
  marginBehind: number;
  /** The camera's diagonal field of view, as spec sheets quote it. */
  diagonalFov: number;
  /** The camera picture's width ÷ height. */
  aspect: number;
  /** Optional check, which overrides `diagonalFov`: what the camera sees across a wall in front of it. */
  measured?: {
    /** From the camera to the wall. */
    distance: number;
    /** The width of wall the picture shows. */
    width: number;
  };
}

/** The assumptions behind the recommendation, which the user may adjust. */
export interface SetupConstants {
  /** The highest camera recommended, before any ceiling lowers it. */
  maxCameraHeight: number;
  /** The lowest camera considered. */
  minCameraHeight: number;
  /** The steepest recommended tilt below horizontal. */
  maxTilt: number;
  /** Fraction of the picture kept clear at each edge, where tracking is weak. */
  edgeInset: number;
  /** Space kept in view above the tallest head. */
  headroom: number;
  /** The widest floor recommended. */
  maxFloorWidth: number;
  /** The deepest floor recommended. */
  maxFloorDepth: number;
  /** Below this multiple of the tallest player's height, the floor is cramped: a warning. */
  minFloorMultiple: number;
  /** The floor's sides never exceed this multiple of the shortest player's height, so no one looks tiny. */
  maxFloorMultiple: number;
}

/** A typical room, family and 4:3 webcam (65° diagonal, which is 42° vertical). */
export const DEFAULT_SETUP_INPUTS: SetupInputs = {
  roomLength: 5,
  roomWidth: 4,
  clearance: 0.2,
  shortestPlayer: 1,
  tallestPlayer: 1.9,
  marginLeft: 0.3,
  marginRight: 0.3,
  marginFar: 0.3,
  marginBehind: 0.5,
  diagonalFov: 65,
  aspect: 4 / 3,
};

/** The default assumptions; the default calibration's 22° tilt sits well inside `maxTilt`. */
export const DEFAULT_SETUP_CONSTANTS: SetupConstants = {
  maxCameraHeight: 3,
  minCameraHeight: 1,
  maxTilt: 35,
  edgeInset: 0.1,
  headroom: 0.1,
  maxFloorWidth: 3,
  maxFloorDepth: 3,
  minFloorMultiple: 0.8,
  maxFloorMultiple: 2.5,
};

/** The camera's usable view, as slopes from its axis. */
export interface CameraView {
  /** Half the usable view, vertically. */
  sv: number;
  /** Half the usable view, horizontally. */
  sh: number;
  /** The tangent of the whole usable vertical view. */
  T: number;
  /** The steepest slope down to the near feet that `maxTilt` allows. */
  pMax: number;
  /** The diagonal field of view a measurement implies, before the inset. */
  impliedDiagonalFov?: number;
}

/** Where the camera and floor go for one camera height. */
export interface SetupLayout {
  /** The camera's height above the floor. */
  cameraHeight: number;
  /** The drop from the camera to just above the tallest head; negative for a low camera. */
  headDrop: number;
  /** The closest the camera can be to the floor while everyone fits in view. */
  minDistance: number;
  /** The distance at which the floor's front edge gets its full width. */
  wideDistance: number;
  /** From the camera to the floor's front edge, along the ground. */
  nearDistance: number;
  /** From the camera to the floor's back edge, along the ground. */
  farDistance: number;
  /** Across the camera's view. */
  floorWidth: number;
  /** Away from the camera. */
  floorDepth: number;
  /** The tilt below horizontal, as a slope. */
  tiltSlope: number;
}

/** The recommendation: a layout, its tilt in degrees, the margins it leaves, and any warnings. */
export interface SetupResult extends SetupLayout {
  /** The camera's usable view the layout was made for. */
  view: CameraView;
  /** The tilt below horizontal. */
  tiltDegrees: number;
  /** How far from the camera the picture's centre meets the floor; absent when the camera doesn't look down. */
  aimPoint?: number;
  /** From the floor's left edge to the wall. */
  marginLeft: number;
  /** From the floor's right edge to the wall. */
  marginRight: number;
  /** From the floor's back edge to the far wall. */
  marginFar: number;
  /** From the camera to the wall behind it. */
  marginBehind: number;
  /** Problems with the space, for the user to read. */
  warnings: string[];
}

/** The steps the height scan takes. */
const HEIGHT_STEP = 0.01;
/** Floors within this fraction of the largest count as just as large, so the lowest height wins. */
const AREA_TOLERANCE = 0.01;

const toSlope = (degrees: number) => Math.tan((degrees * Math.PI) / 180);
const toDegrees = (slope: number) => (Math.atan(slope) * 180) / Math.PI;

/** The larger root of `a·x² + b·x + c = 0`, or 0 when there is no positive one. */
const positiveRoot = (a: number, b: number, c: number) => {
  const discriminant = b * b - 4 * a * c;
  return discriminant < 0 ? 0 : Math.max(0, (-b + Math.sqrt(discriminant)) / (2 * a));
};

/** The camera's usable view, from a measurement if there is one, or else its diagonal field of view. */
export const cameraView = (inputs: SetupInputs, constants: SetupConstants): CameraView => {
  const { measured, aspect } = inputs;
  let sh: number;
  let sv: number;
  if (measured) {
    sh = measured.width / 2 / measured.distance;
    sv = sh / aspect;
  } else {
    sv = toSlope(inputs.diagonalFov / 2) / Math.sqrt(1 + aspect * aspect);
    sh = sv * aspect;
  }
  const impliedDiagonalFov = measured ? 2 * toDegrees(Math.sqrt(sh * sh + sv * sv)) : undefined;
  const keep = 1 - constants.edgeInset;
  sv *= keep;
  sh *= keep;
  const tMax = toSlope(constants.maxTilt);
  const pMaxDenominator = 1 - tMax * sv;
  return {
    sv,
    sh,
    T: (2 * sv) / (1 - sv * sv),
    pMax: pMaxDenominator > 0 ? (tMax + sv) / pMaxDenominator : Infinity,
    impliedDiagonalFov,
  };
};

/** The largest floor that fits the view and the room, with the camera at height `h`. */
export const layoutAt = (h: number, view: CameraView, inputs: SetupInputs, constants: SetupConstants): SetupLayout => {
  const { sv, sh, T, pMax } = view;
  const c = h - inputs.tallestPlayer - constants.headroom;
  const sizeCap = constants.maxFloorMultiple * inputs.shortestPlayer;
  const depthCap = Math.min(constants.maxFloorDepth, sizeCap);
  const widthCap = Math.min(
    inputs.roomWidth - inputs.marginLeft - inputs.marginRight,
    constants.maxFloorWidth,
    sizeCap,
  );
  const length = inputs.roomLength - inputs.marginBehind - inputs.marginFar;

  // The far head binds a camera above head height, and the near head one below it
  const bindingDepth = c >= 0 ? depthCap : 0;
  const minDistance = positiveRoot(T, T * bindingDepth - (h - c), h * (T * c - bindingDepth));
  // The front edge's distance along the camera's axis, and the distance where it shows the full width
  const axial = (d: number) => Math.sqrt((d * d + h * h) / (1 + sv * sv));
  const wideSquared = (widthCap / (2 * sh)) ** 2 * (1 + sv * sv) - h * h;
  const wideDistance = wideSquared > 0 ? Math.sqrt(wideSquared) : 0;

  // In a short room the far edge goes to the limit; otherwise the camera moves back for width
  let nearDistance: number;
  if (c >= 0 && minDistance + depthCap > length && length > 0) {
    const q = c / length;
    const denominator = 1 - q * T;
    nearDistance = denominator > 0 ? (h * denominator) / (q + T) : 0;
  } else {
    nearDistance = Math.max(minDistance, Math.min(wideDistance, length - depthCap));
  }
  nearDistance = Math.max(nearDistance, h / pMax);
  const floorDepth = Math.min(depthCap, length - nearDistance);

  // The bottom of the view on the near feet; `(h/d − sv) / (1 + sv·h/d)`, multiplied through by d
  const tiltSlope = (h - sv * nearDistance) / (nearDistance + h * sv);
  return {
    cameraHeight: h,
    headDrop: c,
    minDistance,
    wideDistance,
    nearDistance,
    farDistance: nearDistance + floorDepth,
    floorDepth,
    floorWidth: Math.min(widthCap, 2 * sh * axial(nearDistance)),
    tiltSlope,
  };
};

const areaOf = ({ floorWidth, floorDepth }: SetupLayout) =>
  floorWidth > 0 && floorDepth > 0 ? floorWidth * floorDepth : 0;

/**
 * The lowest camera height whose floor is (within tolerance) the largest any allowed height gives. Heights below the
 * tallest head are only considered when nothing higher is allowed, and then only the highest, since a low camera lets
 * players in front hide those behind.
 */
const chooseLayout = (view: CameraView, inputs: SetupInputs, constants: SetupConstants): SetupLayout => {
  const ceilingCap = inputs.ceiling === undefined ? Infinity : inputs.ceiling - inputs.clearance;
  const heightCap = Math.max(0, Math.min(constants.maxCameraHeight, ceilingCap));
  const aboveHeads = inputs.tallestPlayer + constants.headroom;
  const lowest = Math.min(heightCap, Math.max(constants.minCameraHeight, aboveHeads));
  const steps = Math.floor((heightCap - lowest) / HEIGHT_STEP + 1e-9);
  const heights = Array.from({ length: steps + 1 }, (_, i) => lowest + i * HEIGHT_STEP);
  const layouts = heights.map((h) => layoutAt(h, view, inputs, constants));
  const largest = Math.max(...layouts.map(areaOf));
  return layouts.find((layout) => areaOf(layout) >= largest * (1 - AREA_TOLERANCE)) ?? layouts[layouts.length - 1];
};

/** What the user should know about the recommendation. */
const warningsFor = (layout: SetupLayout, inputs: SetupInputs, constants: SetupConstants): string[] => {
  const warnings: string[] = [];
  const { floorWidth, floorDepth, cameraHeight } = layout;
  if (floorWidth <= 0 || floorDepth <= 0) {
    warnings.push("Not enough space: raise the ceiling limit, use a wider lens, or reduce the margins.");
  } else if (Math.min(floorWidth, floorDepth) < constants.minFloorMultiple * inputs.tallestPlayer) {
    warnings.push("Players will be large for this floor.");
  }
  if (inputs.ceiling !== undefined && inputs.ceiling - inputs.clearance < constants.minCameraHeight) {
    warnings.push("The ceiling is too low for the camera.");
  }
  if (cameraHeight < inputs.tallestPlayer) {
    warnings.push("The camera is below head height, so players in front may hide those behind.");
  }
  return warnings;
};

/** The recommended camera position and floor for a space, with the margins left over and any warnings. */
export const planSetup = (inputs: SetupInputs, constants: SetupConstants = DEFAULT_SETUP_CONSTANTS): SetupResult => {
  const view = cameraView(inputs, constants);
  if (view.T <= 0) {
    throw new RangeError("The camera's view is too wide: these calculations need less than 90° vertically.");
  }
  const layout = chooseLayout(view, inputs, constants);
  const spareWidth = inputs.roomWidth - inputs.marginLeft - inputs.marginRight - layout.floorWidth;
  return {
    ...layout,
    view,
    tiltDegrees: toDegrees(layout.tiltSlope),
    aimPoint: layout.tiltSlope > 0 ? layout.cameraHeight / layout.tiltSlope : undefined,
    marginLeft: inputs.marginLeft + spareWidth / 2,
    marginRight: inputs.marginRight + spareWidth / 2,
    marginFar: inputs.roomLength - inputs.marginBehind - layout.farDistance,
    marginBehind: inputs.marginBehind,
    warnings: warningsFor(layout, inputs, constants),
  };
};
