import { useState } from "react";
import { Link } from "react-router";
import ReplayView from "../components/debug/ReplayView";
import { readRecording, type UnzippedRecording } from "../debug/Replay";

/** Replays a downloaded debug recording (see camera mode's "Recording"), entirely in the browser. */
export default function ReplayPage() {
  const [unzipped, setUnzipped] = useState<UnzippedRecording>();
  const [error, setError] = useState<string>();

  /** Opens the chosen zip, or says why it can't. */
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      setUnzipped(readRecording(new Uint8Array(await file.arrayBuffer())));
      setError(undefined);
    } catch (reason) {
      setUnzipped(undefined);
      setError(`Couldn't open ${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Replay a recording</h1>
      <p>
        Choose a debug recording's zip to see what the game saw in each frame. It stays on this computer.{" "}
        <Link to="/">Back to games</Link>
      </p>
      <label>
        Recording: <input type="file" accept=".zip" onChange={(e) => void open(e.currentTarget.files?.[0])} />
      </label>
      {error && <p role="alert">{error}</p>}
      {unzipped && <ReplayView key={unzipped.recording.recordedAt} unzipped={unzipped} />}
    </div>
  );
}
