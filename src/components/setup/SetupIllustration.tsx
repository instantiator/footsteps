import { useId } from "react";
import type { SetupInputs, SetupResult } from "./SetupCalculations";
import type { RoomPoint } from "./SetupProjection";

/** Isometric projection from behind the camera: the room's axes at 30° either side of horizontal, and height straight up. */
const COS30 = Math.sqrt(3) / 2;
const project = ([x, y, z]: RoomPoint): [number, number] => [(x + y) * COS30, (x - y) / 2 - z];

const pointsOf = (corners: RoomPoint[]) => corners.map((corner) => project(corner).join(",")).join(" ");

/** Space around the drawing, in metres, so labels at its edges aren't clipped. */
const PADDING = 0.6;

/** A viewBox that fits every point, with padding. */
const viewBoxAround = (points: RoomPoint[]) => {
  const projected = points.map(project);
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  return [minX, minY, Math.max(...xs) + PADDING - minX, Math.max(...ys) + PADDING - minY].join(" ");
};

const metres = (value: number) => `${value.toFixed(2)} m`;

/** Where the drawing's pieces go, in room coordinates. */
interface Scene {
  plan: SetupResult;
  inputs: SetupInputs;
  /** The floor's corners: front left, front right, back right, back left. */
  floor: RoomPoint[];
  camera: RoomPoint;
  centre: number;
  front: number;
  back: number;
}

/** A dimension: a line between two points, with its label at the middle. */
function Dimension({ from, to, label }: { from: RoomPoint; to: RoomPoint; label: string }) {
  const [x1, y1] = project(from);
  const [x2, y2] = project(to);
  return (
    <g className="setup-dimension">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2} dy="-0.08">
        {label}
      </text>
    </g>
  );
}

/** A player as a stick figure of the given height, standing at a point on the floor. */
function Player({ at: [x, y], height }: { at: RoomPoint; height: number }) {
  const [fx, fy] = project([x, y, 0]);
  const [hx, hy] = project([x, y, height]);
  return (
    <g className="setup-player">
      <line x1={fx} y1={fy} x2={hx} y2={hy + 0.15} />
      <circle cx={hx} cy={hy + 0.08} r={0.08} />
    </g>
  );
}

/** The camera on its stand, with its view's bottom edge on the near feet and top edge over the far head. */
function Camera({ scene: { camera, centre, front, back, inputs } }: { scene: Scene }) {
  const [x, y] = project(camera);
  const [, groundY] = project([centre, camera[1], 0]);
  const [nearX, nearY] = project([centre, front, 0]);
  const [farX, farY] = project([centre, back, inputs.tallestPlayer]);
  return (
    <g className="setup-camera">
      <line x1={x} y1={groundY} x2={x} y2={y} />
      <circle cx={x} cy={y} r={0.1} />
      <line className="setup-ray" x1={x} y1={y} x2={nearX} y2={nearY} />
      <line className="setup-ray" x1={x} y1={y} x2={farX} y2={farY} />
    </g>
  );
}

/** Every dimension of the recommendation, marked where it applies. */
function Dimensions({ scene: { plan, inputs, floor, camera, centre, front, back } }: { scene: Scene }) {
  const behind = camera[1];
  return (
    <>
      <Dimension from={floor[0]} to={floor[1]} label={`W ${metres(plan.floorWidth)}`} />
      <Dimension from={floor[1]} to={floor[2]} label={`D ${metres(plan.floorDepth)}`} />
      <Dimension from={[centre, behind, 0]} to={[centre, front, 0]} label={`to floor ${metres(plan.nearDistance)}`} />
      <Dimension
        from={[centre, behind, 0]}
        to={camera}
        label={`h ${metres(plan.cameraHeight)}, tilt ${plan.tiltDegrees.toFixed(0)}°`}
      />
      <Dimension from={[0, front, 0]} to={floor[0]} label={`left ${metres(plan.marginLeft)}`} />
      <Dimension from={floor[1]} to={[inputs.roomWidth, front, 0]} label={`right ${metres(plan.marginRight)}`} />
      <Dimension
        from={[centre, back, 0]}
        to={[centre, inputs.roomLength, 0]}
        label={`beyond ${metres(plan.marginFar)}`}
      />
      <Dimension from={[centre, 0, 0]} to={[centre, behind, 0]} label={`behind ${metres(plan.marginBehind)}`} />
    </>
  );
}

/** The room, floor, camera and players drawn isometrically, with the recommendation's dimensions marked. */
export default function SetupIllustration({ plan, inputs }: { plan: SetupResult; inputs: SetupInputs }) {
  const titleId = useId();
  const { floorWidth: w, floorDepth: d, cameraHeight: h, marginLeft, marginBehind } = plan;
  if (w <= 0 || d <= 0) return <p className="setup-illustration-empty">No floor fits, so there is nothing to draw.</p>;

  const front = marginBehind + plan.nearDistance;
  const back = front + d;
  const centre = marginLeft + w / 2;
  const floor: RoomPoint[] = [
    [marginLeft, front, 0],
    [marginLeft + w, front, 0],
    [marginLeft + w, back, 0],
    [marginLeft, back, 0],
  ];
  const { roomWidth, roomLength } = inputs;
  const room: RoomPoint[] = [
    [0, 0, 0],
    [roomWidth, 0, 0],
    [roomWidth, roomLength, 0],
    [0, roomLength, 0],
  ];
  const scene: Scene = { plan, inputs, floor, camera: [centre, marginBehind, h], centre, front, back };
  const description = `A ${metres(w)} by ${metres(d)} floor, ${metres(plan.nearDistance)} in front of a camera ${metres(h)} high, tilted ${plan.tiltDegrees.toFixed(0)}° down`;

  return (
    <svg
      className="setup-illustration"
      viewBox={viewBoxAround([
        ...room,
        scene.camera,
        [centre, front, inputs.tallestPlayer],
        [centre, back, inputs.tallestPlayer],
      ])}
      aria-labelledby={titleId}
    >
      <title id={titleId}>{description}</title>
      <polygon className="setup-room" points={pointsOf(room)} />
      <polygon className="setup-floor" points={pointsOf(floor)} />
      <Camera scene={scene} />
      <Player at={[centre, front, 0]} height={inputs.tallestPlayer} />
      <Player at={[centre, back, 0]} height={inputs.tallestPlayer} />
      <Dimensions scene={scene} />
    </svg>
  );
}
