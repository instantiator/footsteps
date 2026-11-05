import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { GameState } from "../../entities/state/GameState";

/** Something queued in the game state. */
export interface QueuedItem {
  /** Identifies it; ids only grow, so a queue worked out twice (as React may) starts nothing twice. */
  id: number;
}

/**
 * Takes what rules have queued in the game state: starts each once, then drops it from the queue. Rules are pure
 * functions of the state, so what they ask for happens here.
 * @param queue the queue now
 * @param start starts one item
 * @param withoutUpTo the state without the items up to and including this id
 */
export function useQueueDrain<T extends QueuedItem>(
  queue: T[],
  start: (item: T) => void,
  withoutUpTo: (state: GameState, id: number) => GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
) {
  const startedRef = useRef(0);
  useEffect(() => {
    const fresh = queue.filter(({ id }) => id > startedRef.current);
    if (fresh.length === 0) return;
    startedRef.current = Math.max(...fresh.map(({ id }) => id));
    fresh.forEach(start);
    const started = startedRef.current;
    setGameState((state) => withoutUpTo(state, started));
  }, [queue, start, withoutUpTo, setGameState]);
}
