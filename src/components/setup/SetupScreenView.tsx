import { useId } from "react";
import type { SetupConstants, SetupInputs, SetupResult } from "./SetupCalculations";
import { screenScene, type ScreenLine } from "./SetupProjection";

/** The screen's frame around its picture, in metres. */
const BEZEL = 0.02;

const metres = (value: number) => `${value.toFixed(2)} m`;

/**
 * What the screen shows of the room from the recommended camera position: the room's floor, walls and ceiling as a
 * wireframe, the game floor shaded, the tallest player at its front and back, and the picture's edge kept clear for
 * tracking dashed. The picture is the camera's own, unmirrored, fitted to the screen.
 */
export default function SetupScreenView({
  plan,
  inputs,
  constants,
}: {
  plan: SetupResult;
  inputs: SetupInputs;
  constants: SetupConstants;
}) {
  // React's ids can hold characters that break an SVG `url(#…)` reference
  const id = useId().replace(/[^\w-]/g, "");
  if (plan.floorWidth <= 0 || plan.floorDepth <= 0) return null;

  const { picture, clear, lines, floor } = screenScene(plan, inputs, constants);
  const { screenWidth, screenHeight } = constants;
  const frame = { x: -BEZEL, y: -BEZEL, width: screenWidth + 2 * BEZEL, height: screenHeight + 2 * BEZEL };
  const linesOf = (kind: ScreenLine["kind"]) =>
    lines
      .filter((line) => line.kind === kind)
      .map(({ x1, y1, x2, y2 }, i) => (
        <line key={i} className={`setup-screen-${kind}`} x1={x1} y1={y1} x2={x2} y2={y2} />
      ));

  return (
    <figure className="setup-screen-view">
      <svg viewBox={[frame.x, frame.y, frame.width, frame.height].join(" ")} aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>What the screen shows of the room and the game floor</title>
        <defs>
          <clipPath id={`${id}-picture`}>
            <rect {...picture} />
          </clipPath>
        </defs>
        <rect className="setup-screen-bezel" {...frame} />
        <rect className="setup-screen-glass" x={0} y={0} width={screenWidth} height={screenHeight} />
        <g clipPath={`url(#${id}-picture)`}>
          <rect className="setup-screen-picture" {...picture} />
          {linesOf("room")}
          {floor && <polygon className="setup-screen-floor" points={floor.map((point) => point.join(",")).join(" ")} />}
          {linesOf("player")}
          <rect className="setup-screen-clear" {...clear} />
        </g>
      </svg>
      <figcaption>
        On a {metres(screenWidth)} × {metres(screenHeight)} screen, as the camera sees it (unmirrored): the game floor
        is shaded, and the dashed line marks the edge of the picture kept clear for tracking.
      </figcaption>
    </figure>
  );
}
