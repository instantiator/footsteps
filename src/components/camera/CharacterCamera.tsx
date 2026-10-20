import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { BODY_PARTS } from "./BodySegSupport";
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
}

/** Captures the player's webcam into a small mirrored preview video, for the segmentation to read; optionally with a colour key. */
export default function CharacterCamera({
  stream,
  setStream,
  video,
  setVideo,
  onAspectChange: setAspect,
  colorKey,
}: CharacterCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideo(videoRef.current);
  }, [setVideo, videoRef]);

  useEffect(() => {
    if (video && !stream) {
      getCameraStream().then((mediaStream) => {
        setStream(mediaStream);
        videoRef.current!.srcObject = mediaStream;
        videoRef.current!.play().then(() => {
          setAspect(video.videoWidth / video.videoHeight);
        });
      });
    }
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [video, stream, setStream, setAspect]);

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
        Object.entries(BODY_PARTS).map(([key, part]) => (
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
            <span>
              {part.description} ({part.maskValue})
            </span>
          </div>
        ))}
    </div>
  );
}
