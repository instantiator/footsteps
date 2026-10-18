import { useCallback, useEffect, useId, useState } from "react";
import type { GameChallengeAnswer, GameChallengeAnswerValidation } from "../../../entities/data/GameChallengeSolution";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";

interface GameTextInputComponentProps {
  label?: string;
  stageId?: string;
  challengeId?: string;
  solved?: boolean;
  setSolved?: React.Dispatch<React.SetStateAction<boolean>>;
  onAnswer?: GameAnswerFunction;
  autoSubmit?: boolean;
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
  const [input, setInput] = useState<string>("");
  const [validations, setValidations] = useState<GameChallengeAnswerValidation[]>([]);

  const uid = useId();

  const submitAnswer = useCallback(
    (answer: GameChallengeAnswer) => {
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
    },
    [onAnswer, solved, stageId, challengeId, setSolved],
  );

  useEffect(() => {
    if (isDefined(onAnswer)) {
      if (autoSubmit ?? true) {
        submitAnswer(input);
      }
    }
  }, [input, autoSubmit, onAnswer, submitAnswer]);

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
          style={{
            width: "90%",
            textTransform: "uppercase",
            fontSize: "2em",
            fontFamily: "inherit",
          }}
          onChange={(e) => {
            setInput(e.target.value);
          }}
        />
      </div>
      {validations.length > 0 && (
        <ul style={{ color: "red" }}>
          {validations.map((v, i) => (
            <li key={`validation-${i}`}>{v}</li>
          ))}
        </ul>
      )}
    </>
  );
}
