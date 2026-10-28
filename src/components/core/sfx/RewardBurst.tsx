import { useReward } from "partycles";
import { useEffect, useRef } from "react";
import type { GameRewardData } from "../../../entities/data/GameData";

/** Props for {@link RewardBurst}. */
interface RewardBurstProps {
  /** Identifies this burst among others playing at the same time. */
  id: number;
  /** The celebration to show. */
  reward: GameRewardData;
  /** Called once the animation has finished, so the burst can be removed. */
  onDone: () => void;
}

/**
 * One celebration a rule asked for: shows its partycles animation once, from the middle of the game, when mounted.
 * One per reward, as partycles fixes a hook's animation when the hook is created.
 */
export default function RewardBurst({ id, reward: { animation, particleCount }, onDone }: RewardBurstProps) {
  const elementId = `reward-burst-${id}`;
  const { reward } = useReward(elementId, animation, { particleCount: particleCount ?? 200 });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // once, even when React runs effects twice
    started.current = true;
    void reward().then(onDone);
  }, [reward, onDone]);

  return (
    <div
      id={elementId}
      style={{ position: "absolute", top: "50vh", left: "50vw", width: 0, height: 0, pointerEvents: "none" }}
    />
  );
}
