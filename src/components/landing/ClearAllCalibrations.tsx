import { forgetAllCalibrations } from "../camera/FloorCalibration";

/** A button that forgets every camera configuration's floor, once the player confirms. */
export default function ClearAllCalibrations({ onCleared }: { onCleared: () => void }) {
  return (
    <button
      type="button"
      className="game-button"
      onClick={() => {
        if (!window.confirm("Clear the floor saved for every camera and configuration?")) return;
        forgetAllCalibrations();
        onCleared();
      }}
    >
      Clear all calibrations
    </button>
  );
}
