import { useId, useState } from "react";
import type { GameChallengeAnswer, GameChallengeAnswerValidation } from "../../../entities/data/GameChallengeSolution";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";

export interface GameTextInputComponentProps {
  label?: string;
  stageId?: string;
  challengeId?: string;
  solved?: boolean;
  setSolved?: React.Dispatch<React.SetStateAction<boolean>>;
  onAnswer?: GameAnswerFunction;
  autoSubmit?: boolean;
}

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
      <div style={{ marginTop: "10px", textAlign: "center" }}>
        {label && <p>{label}</p>}
        <input
          id={`input-${stageId}-${challengeId}-${uid}`}
          type="text"
          disabled={solved}
          autoComplete="off"
          autoCorrect="off"
          style={INPUT_STYLE}
          onChange={(e) => {
            if (isDefined(onAnswer) && (autoSubmit ?? true)) submitAnswer(e.target.value);
          }}
        />
      </div>
      <ValidationList validations={validations} />
    </>
  );
}
