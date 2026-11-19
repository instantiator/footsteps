import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router";
import NumberField from "../components/setup/NumberField";
import SetupIllustration from "../components/setup/SetupIllustration";
import SetupScreenView from "../components/setup/SetupScreenView";
import {
  DEFAULT_SETUP_CONSTANTS,
  DEFAULT_SETUP_INPUTS,
  planSetup,
  type SetupConstants,
  type SetupInputs,
  type SetupResult,
} from "../components/setup/SetupCalculations";
import { SETUP_WEBCAMS, startingWebcam, type SetupWebcam } from "../components/setup/SetupWebcams";
import "./SetupPlanner.css";

/** The user's values as the form holds them: any may be blank, and the measurement is two separate fields. */
type FormValues = Partial<Omit<SetupInputs, "measured">> & { measuredDistance?: number; measuredWidth?: number };

/** The form's number fields. */
type FieldKey = Exclude<keyof FormValues, "aspect">;

/** A number field's key, label, step and unit. */
interface FieldSpec<K> {
  key: K;
  label: string;
  step: number;
  unit?: string;
}

const METRES = { step: 0.05, unit: "m" };

/** Where the − and + buttons start from while a field is blank. */
const FORM_FALLBACKS: Record<FieldKey, number> = {
  ...DEFAULT_SETUP_INPUTS,
  ceiling: 2.4,
  measuredDistance: 1,
  measuredWidth: 1,
};

/** The user's values, in the groups the page shows them. */
const INPUT_GROUPS: { legend: string; fields: FieldSpec<FieldKey>[] }[] = [
  {
    legend: "Room",
    fields: [
      { key: "roomLength", label: "Room length (camera's wall to far wall)", ...METRES },
      { key: "roomWidth", label: "Room width", ...METRES },
      { key: "ceiling", label: "Ceiling height (optional)", ...METRES },
      { key: "clearance", label: "Space above the camera", ...METRES },
    ],
  },
  {
    legend: "Players",
    fields: [
      { key: "shortestPlayer", label: "Shortest player", ...METRES },
      { key: "tallestPlayer", label: "Tallest player", ...METRES },
    ],
  },
  {
    legend: "Space taken around the floor",
    fields: [
      { key: "marginLeft", label: "Left of the floor", ...METRES },
      { key: "marginRight", label: "Right of the floor", ...METRES },
      { key: "marginFar", label: "Beyond the floor", ...METRES },
      { key: "marginBehind", label: "Behind the camera, for the screen", ...METRES },
    ],
  },
  {
    legend: "Camera",
    fields: [{ key: "diagonalFov", label: "Diagonal field of view (dFoV)", step: 1, unit: "°" }],
  },
  {
    legend: "Check the field of view (optional)",
    fields: [
      { key: "measuredDistance", label: "Camera's distance from a wall", ...METRES },
      { key: "measuredWidth", label: "Width of wall it shows", ...METRES },
    ],
  },
];

/** The adjustable assumptions. */
const CONSTANT_FIELDS: FieldSpec<keyof SetupConstants>[] = [
  { key: "maxCameraHeight", label: "Highest camera", ...METRES },
  { key: "minCameraHeight", label: "Lowest camera", ...METRES },
  { key: "maxTilt", label: "Steepest tilt", step: 1, unit: "°" },
  { key: "edgeInset", label: "Picture edge kept clear", step: 0.01 },
  { key: "headroom", label: "Space above heads", ...METRES },
  { key: "maxFloorWidth", label: "Widest floor", ...METRES },
  { key: "maxFloorDepth", label: "Deepest floor", ...METRES },
  { key: "minFloorMultiple", label: "Smallest floor, × tallest player", step: 0.05 },
  { key: "maxFloorMultiple", label: "Largest floor, × shortest player", step: 0.05 },
  { key: "screenWidth", label: "Screen width", ...METRES },
  { key: "screenHeight", label: "Screen height", ...METRES },
];

/** The aspect ratios webcams commonly give the browser. */
const ASPECTS = [
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

/** The calculation's inputs: blank required values take their defaults, and the measurement needs both its fields. */
const inputsOf = ({ measuredDistance, measuredWidth, ...values }: FormValues): SetupInputs => {
  const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const measured = measuredDistance && measuredWidth ? { distance: measuredDistance, width: measuredWidth } : undefined;
  return { ...DEFAULT_SETUP_INPUTS, ...filled, measured };
};

const metres = (value: number) => `${value.toFixed(2)} m`;

/**
 * Starts with the camera the game uses, once it's known, filling in its values.
 * @returns the camera chosen in the dropdown, and a way to change it
 */
const useStartingWebcam = (setValues: Dispatch<SetStateAction<FormValues>>) => {
  const [searchParams] = useSearchParams();
  const [index, setIndex] = useState(0);
  const query = searchParams.toString();
  useEffect(() => {
    let cancelled = false;
    startingWebcam(new URLSearchParams(query))
      .then((webcam) => {
        if (cancelled) return;
        setIndex(SETUP_WEBCAMS.indexOf(webcam));
        setValues((old) => withWebcam(old, webcam));
      })
      .catch((error: unknown) => console.warn("Could not find the camera to plan for:", error));
    return () => {
      cancelled = true;
    };
  }, [query, setValues]);
  return { index, setIndex };
};

/**
 * Works out how big a floor a room allows and where to put the camera: the user's values and the assumptions on the
 * left, and the recommendation on the right.
 */
export default function SetupPlanner() {
  const [values, setValues] = useState<FormValues>(DEFAULT_SETUP_INPUTS);
  const [constants, setConstants] = useState<SetupConstants>(DEFAULT_SETUP_CONSTANTS);
  const webcam = useStartingWebcam(setValues);
  const inputs = useMemo(() => inputsOf(values), [values]);
  const plan = useMemo(() => {
    try {
      return planSetup(inputs, constants);
    } catch (error) {
      if (error instanceof RangeError) return error.message;
      throw error;
    }
  }, [inputs, constants]);

  return (
    <div className="setup-planner">
      <h1>Plan your space</h1>
      <p>
        Find out whether your room is big enough to play, and where to put the camera. <Link to="/">Back to games</Link>
      </p>
      <Explanation />
      <div className="setup-columns">
        <div>
          <InputFields values={values} setValues={setValues} webcam={webcam} />
          <ConstantFields constants={constants} setConstants={setConstants} />
        </div>
        <div>
          {typeof plan === "string" ? (
            <p className="setup-warning">{plan}</p>
          ) : (
            <>
              <Results plan={plan} />
              <SetupIllustration plan={plan} inputs={inputs} />
              <SetupScreenView plan={plan} inputs={inputs} constants={constants} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The user's values, grouped, with the camera's picture shape among them. */
function InputFields({
  values,
  setValues,
  webcam,
}: {
  values: FormValues;
  setValues: Dispatch<SetStateAction<FormValues>>;
  webcam: { index: number; setIndex: (index: number) => void };
}) {
  return INPUT_GROUPS.map(({ legend, fields }) => (
    <fieldset key={legend}>
      <legend>{legend}</legend>
      {fields.map(({ key, label, step, unit }) => (
        <NumberField
          key={key}
          label={label}
          step={step}
          unit={unit}
          value={values[key]}
          fallback={FORM_FALLBACKS[key]}
          onChange={(value) => setValues((old) => ({ ...old, [key]: value }))}
        />
      ))}
      {legend === "Camera" && (
        <>
          <AspectChoice
            value={values.aspect ?? DEFAULT_SETUP_INPUTS.aspect}
            onChange={(aspect) => setValues((old) => ({ ...old, aspect }))}
          />
          <WebcamChoice {...webcam} onUse={(chosen) => setValues((old) => withWebcam(old, chosen))} />
        </>
      )}
    </fieldset>
  ));
}

/** The assumptions, each falling back to its default when cleared, with a button to restore them all. */
function ConstantFields({
  constants,
  setConstants,
}: {
  constants: SetupConstants;
  setConstants: Dispatch<SetStateAction<SetupConstants>>;
}) {
  return (
    <fieldset>
      <legend>Assumptions</legend>
      {CONSTANT_FIELDS.map(({ key, label, step, unit }) => (
        <NumberField
          key={key}
          label={label}
          step={step}
          unit={unit}
          value={constants[key]}
          fallback={DEFAULT_SETUP_CONSTANTS[key]}
          onChange={(value) => setConstants((old) => ({ ...old, [key]: value ?? DEFAULT_SETUP_CONSTANTS[key] }))}
        />
      ))}
      <button type="button" onClick={() => setConstants(DEFAULT_SETUP_CONSTANTS)}>
        Reset defaults
      </button>
    </fieldset>
  );
}

/** The form with a camera's field of view, where known, and shape, in place of any measurement. */
const withWebcam = (values: FormValues, { diagonalFov, aspect }: SetupWebcam): FormValues => ({
  ...values,
  diagonalFov: diagonalFov ?? values.diagonalFov,
  aspect,
  measuredDistance: undefined,
  measuredWidth: undefined,
});

/** A choice of the known webcams, filling in the camera's values when used. */
function WebcamChoice({
  index,
  setIndex,
  onUse,
}: {
  index: number;
  setIndex: (index: number) => void;
  onUse: (webcam: SetupWebcam) => void;
}) {
  return (
    <div className="number-field setup-webcam">
      <label htmlFor="setup-webcam">Known webcam</label>
      <select id="setup-webcam" value={index} onChange={(event) => setIndex(Number(event.target.value))}>
        {SETUP_WEBCAMS.map(({ name }, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onUse(SETUP_WEBCAMS[index])}>
        Use this camera
      </button>
    </div>
  );
}

/** A choice of the camera picture's shape. */
function AspectChoice({ value, onChange }: { value: number; onChange: (aspect: number) => void }) {
  return (
    <div className="number-field">
      <label htmlFor="setup-aspect">Picture shape</label>
      <select id="setup-aspect" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {ASPECTS.map(({ label, value: aspect }) => (
          <option key={label} value={aspect}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The recommendation, with any warnings first. */
function Results({ plan }: { plan: SetupResult }) {
  const rows: [string, string][] = [
    ["Floor", `${metres(plan.floorWidth)} wide × ${metres(plan.floorDepth)} deep`],
    ["Camera to the floor's front edge", metres(plan.nearDistance)],
    ["Camera height", metres(plan.cameraHeight)],
    ["Camera tilt, below horizontal", `${plan.tiltDegrees.toFixed(0)}°`],
    [
      "Picture's centre meets the floor",
      plan.aimPoint === undefined ? "—" : `${metres(plan.aimPoint)} from the camera`,
    ],
    ["Space left of the floor", metres(plan.marginLeft)],
    ["Space right of the floor", metres(plan.marginRight)],
    ["Space beyond the floor", metres(plan.marginFar)],
    ["Camera to the wall behind it", metres(plan.marginBehind)],
  ];
  if (plan.view.impliedDiagonalFov !== undefined) {
    rows.push(["Diagonal field of view measured", `${plan.view.impliedDiagonalFov.toFixed(0)}°`]);
  }

  return (
    <section aria-label="Recommendation">
      <h2>Recommendation</h2>
      {plan.warnings.length > 0 && (
        <ul className="setup-warnings">
          {plan.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <table className="setup-results">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** How the recommendation is worked out, in plain words, folded away until asked for. */
function Explanation() {
  return (
    <details className="setup-explanation">
      <summary>How it works</summary>
      <p>The recommendation looks for the largest floor that:</p>
      <ul>
        <li>fits in the camera&apos;s picture, with a little space at the edges, where tracking is weakest;</li>
        <li>shows the tallest player head to toe, with a little space above their head, at its front and its back;</li>
        <li>isn&apos;t so big that the shortest player looks tiny on it.</li>
      </ul>
      <p>
        It tries every camera height from just above the tallest head up to the highest allowed (lowered by any ceiling)
        and recommends the lowest that gives the largest floor. At each height, it moves the camera back from the floor
        until the bottom of the picture reaches the front edge&apos;s feet and the top clears the heads, then further,
        while the room allows, until the front edge is as wide as it can be. The camera tilts so that the bottom of the
        picture lands on the floor&apos;s front edge, and never more steeply than the steepest tilt.
      </p>
      <p>
        Webcam spec sheets usually give a diagonal field of view. If yours doesn&apos;t, check it: stand the camera a
        metre from a wall and measure how much of the wall it shows across.
      </p>
    </details>
  );
}
