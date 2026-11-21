import { DEFAULT_SETUP_INPUTS, planSetup } from "./SetupCalculations";

const metres = (value: number) => `${value.toFixed(1)} m`;

/** Plain-language advice for choosing the playing area and placing the camera, worked through with the planner's defaults. */
export default function SpaceExplainer() {
  const { roomLength, roomWidth, shortestPlayer, tallestPlayer, diagonalFov } = DEFAULT_SETUP_INPUTS;
  const plan = planSetup(DEFAULT_SETUP_INPUTS);
  return (
    <details className="game-panel setup-group">
      <summary>Getting the most from your space</summary>
      <ol>
        <li>
          <strong>Choose your playing area first,</strong> and make it as large as you can. The bigger the area, the
          smaller the players are compared with the game, so the scenes feel bigger.
        </li>
        <li>
          <strong>Keep it a rectangle,</strong> and mark its four corners on the floor, with tape or small mats.
        </li>
        <li>
          <strong>Then place the camera.</strong>
          <ul>
            <li>
              <strong>Height:</strong> a higher camera sees more of the floor and looks down on it, so feet are easier
              to place, but people look shorter.
            </li>
            <li>
              <strong>Distance:</strong> further back, the camera fits a wider area, but each person is smaller and less
              detailed in the picture.
            </li>
          </ul>
        </li>
      </ol>
      <p>
        <strong>An example.</strong> A room {roomLength} m long and {roomWidth} m wide, with players from{" "}
        {shortestPlayer} m to {tallestPlayer} m tall, and a camera with a {diagonalFov}° view. The planner suggests a
        floor {metres(plan.floorWidth)} wide and {metres(plan.floorDepth)} deep, with the camera{" "}
        {metres(plan.cameraHeight)} up, {metres(plan.nearDistance)} back from the floor&apos;s front edge, and tilted
        down by {plan.tiltDegrees.toFixed(0)}°. Try your own room above.
      </p>
    </details>
  );
}
