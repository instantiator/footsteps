import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { Recorder, RecorderState } from "./Recorder";

/** The game's debug recorder; none outside a game. */
export const RecorderContext = createContext<Recorder | null>(null);

/** How often the elapsed time shown while recording updates, in milliseconds. */
const TICK_MS = 500;

/** What the HUD shows of the recorder. */
export interface RecorderView {
  /** The recorder, if there is one. */
  recorder: Recorder | null;
  /** Whether nothing is recorded, a recording runs, or one is held. */
  state: RecorderState;
  /** Whether there is a camera to record. */
  canRecord: boolean;
  /** How long the recording has run, in milliseconds. */
  elapsedMs: number;
}

/** The game's recorder and its state, re-rendering as it changes and, while recording, as time passes. */
export const useRecorder = (): RecorderView => {
  const recorder = useContext(RecorderContext);
  const subscribe = useCallback(
    (listener: () => void) => recorder?.subscribe(listener) ?? (() => undefined),
    [recorder],
  );
  const state = useSyncExternalStore(subscribe, () => recorder?.state ?? "idle");
  const canRecord = useSyncExternalStore(subscribe, () => recorder?.canRecord ?? false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => tick((n) => n + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [state]);
  return { recorder, state, canRecord, elapsedMs: recorder?.elapsedMs ?? 0 };
};
