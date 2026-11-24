import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { drawFrame, frameAt, scenesAt, type UnzippedRecording } from "../../debug/Replay";
import type { RecordedFrameEntry } from "../../debug/RecordingFormat";

/** A video file from the recording, as a URL to play, released when the view goes. */
const useVideoUrl = (files: UnzippedRecording["files"], path: string | undefined, type: string) => {
  const url = useMemo(
    () => (path && files[path] ? URL.createObjectURL(new Blob([files[path].slice()], { type })) : undefined),
    [files, path, type],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
};

/**
 * A `MediaRecorder` video has no length in its header, so the browser can't seek it or show its length: seeking past
 * the end makes it find out, then it goes back to the start.
 */
const findLength = (video: HTMLVideoElement) => {
  if (video.duration !== Infinity) return;
  video.addEventListener("durationchange", () => (video.currentTime = 0), { once: true });
  video.currentTime = Number.MAX_SAFE_INTEGER;
};

/** Draws the recorded frame for each video frame shown, playing or stepped to, and gives the frame shown. */
const useOverlay = (
  video: RefObject<HTMLVideoElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  { recording, files }: UnzippedRecording,
) => {
  const [frame, setFrame] = useState<RecordedFrameEntry>();
  const show = useCallback(
    (seconds: number) => {
      const shown = frameAt(recording, seconds * 1000);
      const ctx = canvas.current?.getContext("2d");
      if (ctx) {
        if (shown) drawFrame(ctx, shown, files);
        else ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      setFrame(shown);
    },
    [recording, files, canvas],
  );
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    let request = 0;
    const each: VideoFrameRequestCallback = (_, { mediaTime }) => {
      show(mediaTime);
      request = player.requestVideoFrameCallback(each);
    };
    request = player.requestVideoFrameCallback(each);
    const seeked = () => show(player.currentTime);
    player.addEventListener("seeked", seeked);
    return () => {
      player.cancelVideoFrameCallback(request);
      player.removeEventListener("seeked", seeked);
    };
  }, [video, show]);
  return frame;
};

/** Keeps the screen's video playing, paused and seeked in step with the camera's. */
const useInStep = (camera: RefObject<HTMLVideoElement | null>, screen: RefObject<HTMLVideoElement | null>) => {
  useEffect(() => {
    const [leader, follower] = [camera.current, screen.current];
    if (!leader || !follower) return;
    const play = () => void follower.play();
    const pause = () => follower.pause();
    const align = () => {
      if (Math.abs(follower.currentTime - leader.currentTime) > 0.1) follower.currentTime = leader.currentTime;
    };
    const events: [string, () => void][] = [
      ["play", play],
      ["pause", pause],
      ["seeked", align],
      ["timeupdate", align],
    ];
    events.forEach(([name, handler]) => leader.addEventListener(name, handler));
    return () => events.forEach(([name, handler]) => leader.removeEventListener(name, handler));
  }, [camera, screen]);
};

/** The recorded frame shown: when it was, the scenes, and each person the game tracked. */
function FrameDetails({ recording, frame }: { recording: UnzippedRecording["recording"]; frame?: RecordedFrameEntry }) {
  if (!frame) return <p id="replay-frame">Before the first frame the game processed.</p>;
  const scenes = scenesAt(recording, frame.videoMs);
  return (
    <div id="replay-frame">
      <p>
        Frame {frame.index + 1} of {recording.frames.length}, at {(frame.videoMs / 1000).toFixed(2)} s; the model took{" "}
        {Math.round(frame.inferenceMs)} ms and found {frame.detected.length}.
      </p>
      {scenes && <p>Scenes: {scenes.scenes}</p>}
      <ul>
        {frame.players.map(({ id, number, role, position, offBy }) => (
          <li key={id}>
            Player {number ?? "?"} (id {id}): {role}, {frame.states[id] ?? "state not recorded"}
            {position && `, at (${Math.round(position.x)}, ${Math.round(position.y)})`}
            {offBy > 0 && `, ${offBy.toFixed(1)} off the floor`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Replays a debug recording: the camera's video with what the game saw drawn over it, frame by frame, and the game's
 * screen beside it when that was recorded.
 */
export default function ReplayView({ unzipped }: { unzipped: UnzippedRecording }) {
  const { recording, files } = unzipped;
  const camera = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cameraUrl = useVideoUrl(files, recording.video, recording.videoType);
  const screenUrl = useVideoUrl(files, recording.screen, recording.videoType);
  const frame = useOverlay(camera, canvas, unzipped);
  useInStep(camera, screen);

  /** Shows the recorded frame before or after the one shown. */
  const step = (by: number) => {
    const next = recording.frames[(frame ? frame.index : -1) + by];
    if (next && camera.current) camera.current.currentTime = next.videoMs / 1000 + 0.001;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 30rem" }}>
          <video
            ref={camera}
            src={cameraUrl}
            controls
            muted
            style={{ width: "100%" }}
            onLoadedMetadata={(e) => findLength(e.currentTarget)}
          />
          <canvas
            ref={canvas}
            id="replay-overlay"
            style={{ position: "absolute", inset: 0, width: "100%", pointerEvents: "none", opacity: 0.7 }}
          />
        </div>
        {screenUrl && (
          <video
            ref={screen}
            src={screenUrl}
            muted
            style={{ flex: "1 1 30rem", width: "100%" }}
            onLoadedMetadata={(e) => findLength(e.currentTarget)}
          />
        )}
      </div>
      <p>
        <button type="button" onClick={() => step(-1)}>
          Previous frame
        </button>{" "}
        <button type="button" onClick={() => step(1)}>
          Next frame
        </button>
      </p>
      <FrameDetails recording={recording} frame={frame} />
    </div>
  );
}
