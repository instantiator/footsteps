import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import useAppConfig from "../../providers/AppConfigHook";
import { isDefined } from "../../util/ObjectUtils";
import { BODY_PART_STYLES } from "../../vision/BodyPart";
import { getCameraStream } from "./CameraSupport";

/** Props for {@link CharacterCamera}. State is held by the parent, so sibling components can share the video and stream. */
interface CharacterCameraProps {
  /** The webcam stream, once the player has granted access. */
  stream: MediaStream | undefined;
  setStream: Dispatch<SetStateAction<MediaStream | undefined>>;
  /** The preview's video element, once rendered. */
  video: HTMLVideoElement | null;
  setVideo: Dispatch<SetStateAction<HTMLVideoElement | null>>;
  /** Reports the video's aspect ratio (width / height) once it is playing. */
  onAspectChange: Dispatch<SetStateAction<number | undefined>>;
  /** Whether to show the colour key for the body parts, as used in a coloured mask. */
  colorKey: boolean;
  /** Called when the camera can't start (refused, missing or busy). Keep it stable: a new one restarts the camera. */
  onError: () => void;
}

/** Stops every track in a stream, which turns the camera off. */
const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

/** Starts the camera once the video element exists: shares the stream once it is playing, and reports a failure. */
function useCameraStart(
  videoRef: RefObject<HTMLVideoElement | null>,
  {
    video,
    stream,
    setStream,
    setAspect,
    onError,
  }: Pick<CharacterCameraProps, "video" | "stream" | "setStream" | "onError"> & {
    setAspect: CharacterCameraProps["onAspectChange"];
  },
) {
  const { cameraWidth: width, cameraHeight: height } = useAppConfig();
  // An abandoned start turns the camera straight off again
  useEffect(() => {
    const element = videoRef.current;
    if (!video || !element || stream) return;
    let cancelled = false;
    let opened: MediaStream | undefined;
    const start = async () => {
      opened = await getCameraStream({ width, height });
      if (cancelled) return stopTracks(opened);
      element.srcObject = opened;
      await element.play();
      if (cancelled) return stopTracks(opened);
      setStream(opened);
      setAspect(element.videoWidth / element.videoHeight);
    };
    start().catch((error: unknown) => {
      if (isDefined(opened)) stopTracks(opened);
      if (cancelled) return;
      console.warn("The camera could not start:", error);
      onError();
    });
    return () => {
      cancelled = true;
    };
  }, [videoRef, video, stream, setStream, setAspect, onError, width, height]);

  // The shared stream's tracks stop when it is replaced or the camera unmounts
  useEffect(() => () => stream && stopTracks(stream), [stream]);
}

/** Captures the player's webcam into a small mirrored preview video, for the segmentation to read; optionally with a colour key. */
export default function CharacterCamera({
  stream,
  setStream,
  video,
  setVideo,
  onAspectChange: setAspect,
  colorKey,
  onError,
}: CharacterCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideo(videoRef.current);
  }, [setVideo, videoRef]);

  useCameraStart(videoRef, { video, stream, setStream, setAspect, onError });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "start" }}>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- a live, silent preview of the player: nothing to caption */}
      <video
        ref={videoRef}
        style={{
          width: "12vw",
          height: "auto",
          transform: "scaleX(-1)",
          border: "solid 2px grey",
        }}
        autoPlay
        playsInline
      />
      {colorKey &&
        Object.entries(BODY_PART_STYLES).map(([key, part]) => (
          <div key={`body-part-${key}`} style={{ display: "flex", alignItems: "center", backgroundColor: "#ffffffaa" }}>
            <div
              style={{
                width: "1rem",
                height: "1rem",
                backgroundColor: `rgba(${part.color.r}, ${part.color.g}, ${part.color.b}, ${part.color.a / 255})`,
                marginRight: "0.5rem",
                border: "solid 1px black",
              }}
            />
            <span>{part.description}</span>
          </div>
        ))}
    </div>
  );
}
