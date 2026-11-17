import { useId } from "react";

/** Props for {@link NumberField}. */
interface NumberFieldProps {
  /** What the value is, also used in the buttons' labels. */
  label: string;
  /** The value, or undefined while the field is blank. */
  value: number | undefined;
  /** Called with the new value, or undefined when the field is cleared. */
  onChange: (value: number | undefined) => void;
  /** How far the − and + buttons move the value, and what it is rounded to. */
  step: number;
  /** Where the buttons start from while the field is blank. */
  fallback: number;
  /** The smallest value the buttons go to. */
  min?: number;
  /** Shown after the field, such as "m" or "°". */
  unit?: string;
}

/** Rounds to a whole number of steps, without the float noise that repeated stepping would add. */
const roundToStep = (value: number, step: number) => {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number((Math.round(value / step) * step).toFixed(decimals));
};

/** A labelled number input with − and + buttons, so a value can be nudged while watching what it changes. */
export default function NumberField({ label, value, onChange, step, fallback, min = 0, unit }: NumberFieldProps) {
  const id = useId();
  const nudge = (direction: 1 | -1) =>
    onChange(Math.max(min, roundToStep((value ?? fallback) + direction * step, step)));

  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <span className="number-field-controls">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => nudge(-1)}>
          −
        </button>
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          value={value ?? ""}
          placeholder={String(fallback)}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => nudge(1)}>
          +
        </button>
        <span className="number-field-unit">{unit}</span>
      </span>
    </div>
  );
}
