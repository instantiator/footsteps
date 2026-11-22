import { useEffect, useMemo, type ReactNode } from "react";
import useAppConfig from "../providers/AppConfigHook";
import { Recorder } from "./Recorder";
import { RecorderContext } from "./RecorderContext";

/** Gives a game its debug recorder, discarding any recording when the game closes. */
export default function RecorderProvider({ children }: { children: ReactNode }) {
  const { recordingMaxSeconds } = useAppConfig();
  const recorder = useMemo(() => new Recorder({ maxMs: recordingMaxSeconds * 1000 }), [recordingMaxSeconds]);
  useEffect(() => () => recorder.discard(), [recorder]);
  return <RecorderContext.Provider value={recorder}>{children}</RecorderContext.Provider>;
}
