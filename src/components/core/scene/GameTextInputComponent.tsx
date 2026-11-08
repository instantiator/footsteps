import { useId, useState } from "react";
import type { GameChallengeAnswer, GameChallengeAnswerValidation } from "../../../entities/data/GameChallengeSolution";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";

/** Props for {@link GameTextInputComponent}. */
export interface GameTextInputComponentProps {
  /** Prompt shown above the input. */
  label?: string;
  /** Stage of the challenge that answers are submitted to; required to submit. */
  stageId?: string;
  /** Challenge that answers are submitted to; required to submit. */
  challengeId?: string;
  /** Whether the challenge is solved; the input is then disabled and further answers ignored. */
  solved?: boolean;
  /** Lets the input record the outcome of a submission for its parent. */
  setSolved?: React.Dispatch<React.SetStateAction<boolean>>;
  /** Submits an answer; nothing is submitted without it. */
  onAnswer?: GameAnswerFunction;
  /** Submit on every change rather than on request. Defaults to true. */
  autoSubmit?: boolean;
}

/** Large, upper-case answer box. */
const INPUT_STYLE: React.CSSProperties = {
  width: "90%",
  textTransform: "uppercase",
  fontSize: "2em",
  fontFamily: "inherit",
};

/** Why the last answer was wrong, if the challenge says. */
function ValidationList({ validations }: { validations: GameChallengeAnswerValidation[] }) {
  if (validations.length === 0) return null;
  return (
    <ul style={{ color: "red" }}>
      {validations.map((v, i) => (
        <li key={`validation-${i}`}>{v}</li>
      ))}
    </ul>
  );
}

/**
 * The answer box for a challenge: submits to `onAnswer` on every change when `autoSubmit` (the default),
 * otherwise on Enter, and lists why a wrong answer was wrong.
 */
export default function GameTextInputComponent({
  label,
  stageId,
  challengeId,
  solved,
  setSolved,
  onAnswer,
  autoSubmit,
}: GameTextInputComponentProps) {
  const [validations, setValidations] = useState<GameChallengeAnswerValidation[]>([]);

  const uid = useId();

  const submitAnswer = (answer: GameChallengeAnswer) => {
    if (!isDefined(onAnswer)) {
      throw new Error("No onAnswer handler defined.");
    }
    if (solved) {
      return;
    }
    if (!isDefined(stageId) || !isDefined(challengeId)) {
      throw new Error(`Stage id (${stageId}) and challenge id (${challengeId}) must be defined to submit an answer.`);
    }
    const validation = onAnswer(stageId, challengeId, answer);
    setSolved?.(validation === true);
    setValidations(validation === true ? [] : validation);
  };

  return (
    <>
      <form
        style={{ marginTop: "10px", textAlign: "center" }}
        onSubmit={(e) => {
          e.preventDefault(); // stay on the page
          if (isDefined(onAnswer) && !(autoSubmit ?? true))
            submitAnswer(String(new FormData(e.currentTarget).get("answer") ?? ""));
        }}
      >
        {label && <p>{label}</p>}
        <input
          id={`input-${stageId}-${challengeId}-${uid}`}
          name="answer"
          type="text"
          disabled={solved}
          autoComplete="off"
          autoCorrect="off"
          style={INPUT_STYLE}
          onChange={(e) => {
            if (isDefined(onAnswer) && (autoSubmit ?? true)) submitAnswer(e.target.value);
          }}
        />
      </form>
      <ValidationList validations={validations} />
    </>
  );
}
