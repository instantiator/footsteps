import type { FloorSizeText } from "../camera/FloorSize";

/** Props for {@link FloorSizeFields}. */
interface FloorSizeFieldsProps {
  /** The size as typed. */
  text: FloorSizeText;
  /** Whether what's typed can't be saved: one field is blank, or a size is out of range. */
  invalid: boolean;
  /** Called with the size as typed. */
  onChange: (text: FloorSizeText) => void;
}

/** One measurement, in metres. */
function MetresField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0.5"
        max="20"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      m
    </label>
  );
}

/**
 * The floor's measured width and depth, which are optional: with them, games can size doors, rings and the like to
 * people in this room. It reminds the player that the playing area must be a rectangle.
 */
export default function FloorSizeFields({ text, invalid, onChange }: FloorSizeFieldsProps) {
  return (
    <fieldset className="calibration-size">
      <legend>Floor size (optional)</legend>
      <MetresField label="Width" value={text.width} onChange={(width) => onChange({ ...text, width })} />
      <MetresField label="Depth" value={text.depth} onChange={(depth) => onChange({ ...text, depth })} />
      {/* The warning takes the note's place, so the row keeps its height under the picture */}
      {invalid ? (
        <p role="alert">Enter both, between 0.5 and 20 m, or leave both blank.</p>
      ) : (
        <p>
          The playing area must be a <strong>rectangle</strong>. Measure it to make games life-size in your room.
        </p>
      )}
    </fieldset>
  );
}
