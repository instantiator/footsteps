import type { SetupConstants, SetupInputs, SetupResult } from "./SetupCalculations";

/**
 * What the camera sees of the room: a pinhole projection from the recommended camera position and tilt into the
 * camera's picture. Picture coordinates run −1 to 1, left to right and top to bottom, across the whole picture.
 */

/** A point in the room, in metres: x across from the left wall, y forward from the wall behind the camera, z up. */
export type RoomPoint = [x: number, y: number, z: number];

/** A point in the picture: −1 to 1, left to right and top to bottom. */
export type PicturePoint = [x: number, y: number];

/** Where the camera is and how it looks. */
export interface CameraPose {
  /** Where the camera's lens is. */
  position: RoomPoint;
  /** The tilt below horizontal, as a slope. */
  tiltSlope: number;
  /** Half the whole picture, vertically, as a slope from the camera's axis. */
  sv: number;
  /** Half the whole picture, horizontally. */
  sh: number;
}

/** How close to the camera a line may come before it is cut off, in metres, so nothing divides by zero. */
const NEAR = 0.05;

/** A point relative to the camera: across to the right, up, and along its axis. */
const toCamera = ({ position: [cx, cy, cz], tiltSlope }: CameraPose, [x, y, z]: RoomPoint): RoomPoint => {
  const length = Math.sqrt(1 + tiltSlope * tiltSlope);
  const [cos, sin] = [1 / length, tiltSlope / length];
  const [dy, dz] = [y - cy, z - cz];
  return [x - cx, dy * sin + dz * cos, dy * cos - dz * sin];
};

const toPicture = ({ sv, sh }: CameraPose, [x, up, along]: RoomPoint): PicturePoint => [
  x / along / sh,
  -up / along / sv,
];

/** A point's place in the picture, or undefined when it is behind the camera. */
export const projectPoint = (pose: CameraPose, point: RoomPoint): PicturePoint | undefined => {
  const relative = toCamera(pose, point);
  return relative[2] < NEAR ? undefined : toPicture(pose, relative);
};

/** A line's place in the picture, cut off where it passes behind the camera, or undefined if it's all behind. */
export const projectSegment = (
  pose: CameraPose,
  from: RoomPoint,
  to: RoomPoint,
): [PicturePoint, PicturePoint] | undefined => {
  let a = toCamera(pose, from);
  let b = toCamera(pose, to);
  if (a[2] < NEAR && b[2] < NEAR) return undefined;
  const cut = (inside: RoomPoint, outside: RoomPoint): RoomPoint => {
    const share = (inside[2] - NEAR) / (inside[2] - outside[2]);
    const at = (i: number) => inside[i] + (outside[i] - inside[i]) * share;
    return [at(0), at(1), at(2)];
  };
  if (a[2] < NEAR) a = cut(b, a);
  if (b[2] < NEAR) b = cut(a, b);
  return [toPicture(pose, a), toPicture(pose, b)];
};

/** The edges of a box-shaped room, `height` high: its floor, its ceiling, and its corners. */
export const roomEdges = (width: number, length: number, height: number): [RoomPoint, RoomPoint][] => {
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, length],
    [0, length],
  ];
  return corners.flatMap(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % corners.length];
    return [
      [
        [x, y, 0],
        [nx, ny, 0],
      ],
      [
        [x, y, height],
        [nx, ny, height],
      ],
      [
        [x, y, 0],
        [x, y, height],
      ],
    ];
  });
};

/** How high the walls are drawn when the user hasn't given a ceiling. */
const DEFAULT_WALL_HEIGHT = 2.4;

/** A rectangle on the screen, in metres from its top left. */
export interface ScreenRect {
  /** From the screen's left edge. */
  x: number;
  /** From the screen's top edge. */
  y: number;
  /** Across. */
  width: number;
  /** Down. */
  height: number;
}

/** A line on the screen, in metres from its top left, with what it shows. */
export interface ScreenLine {
  /** Whether it is one of the room's edges or a player. */
  kind: "room" | "player";
  /** One end, from the screen's left edge. */
  x1: number;
  /** One end, from the screen's top edge. */
  y1: number;
  /** The other end, from the screen's left edge. */
  x2: number;
  /** The other end, from the screen's top edge. */
  y2: number;
}

/** What the screen shows of a recommendation, in metres from the screen's top left. */
export interface ScreenScene {
  /** Where the camera's picture sits: as large as fits, centred. */
  picture: ScreenRect;
  /** The part of the picture inside the edge kept clear for tracking. */
  clear: ScreenRect;
  /** The room's edges, and the tallest player at the floor's front left and back right, cut off behind the camera. */
  lines: ScreenLine[];
  /** The game floor's corners, absent if any is behind the camera. */
  floor?: [number, number][];
}

/** The camera at its recommended place, looking along the floor's centre line, with its whole picture. */
const poseOf = (plan: SetupResult, constants: SetupConstants): CameraPose => {
  const keep = 1 - constants.edgeInset;
  return {
    position: [plan.marginLeft + plan.floorWidth / 2, plan.marginBehind, plan.cameraHeight],
    tiltSlope: plan.tiltSlope,
    sv: plan.view.sv / keep,
    sh: plan.view.sh / keep,
  };
};

/** Lays the camera's picture of the room onto the screen. */
export const screenScene = (plan: SetupResult, inputs: SetupInputs, constants: SetupConstants): ScreenScene => {
  const { screenWidth, screenHeight, edgeInset } = constants;
  const width = Math.min(screenWidth, screenHeight * inputs.aspect);
  const height = width / inputs.aspect;
  const picture = { x: (screenWidth - width) / 2, y: (screenHeight - height) / 2, width, height };
  const toScreen = ([x, y]: PicturePoint): [number, number] => [
    picture.x + ((x + 1) / 2) * width,
    picture.y + ((y + 1) / 2) * height,
  ];
  const pose = poseOf(plan, constants);
  const [front, back] = [plan.marginBehind + plan.nearDistance, plan.marginBehind + plan.farDistance];
  const [left, right] = [plan.marginLeft, plan.marginLeft + plan.floorWidth];

  const room = roomEdges(inputs.roomWidth, inputs.roomLength, inputs.ceiling ?? DEFAULT_WALL_HEIGHT);
  // A quarter of the way in from either side, so the front player doesn't hide the back one
  const quarter = plan.floorWidth / 4;
  const spots: [number, number][] = [
    [left + quarter, front],
    [right - quarter, back],
  ];
  const players = spots.map(([x, y]): [RoomPoint, RoomPoint] => [
    [x, y, 0],
    [x, y, inputs.tallestPlayer],
  ]);
  const lineOf =
    (kind: ScreenLine["kind"]) =>
    ([from, to]: [RoomPoint, RoomPoint]): ScreenLine[] => {
      const ends = projectSegment(pose, from, to);
      if (!ends) return [];
      const [[x1, y1], [x2, y2]] = ends.map(toScreen);
      return [{ kind, x1, y1, x2, y2 }];
    };
  const corners: RoomPoint[] = [
    [left, front, 0],
    [right, front, 0],
    [right, back, 0],
    [left, back, 0],
  ];
  const floor = corners.flatMap((corner) => {
    const point = projectPoint(pose, corner);
    return point ? [toScreen(point)] : [];
  });
  const keep = 1 - edgeInset;
  return {
    picture,
    clear: {
      x: picture.x + (edgeInset * width) / 2,
      y: picture.y + (edgeInset * height) / 2,
      width: keep * width,
      height: keep * height,
    },
    lines: [...room.flatMap(lineOf("room")), ...players.flatMap(lineOf("player"))],
    floor: floor.length === corners.length ? floor : undefined,
  };
};
