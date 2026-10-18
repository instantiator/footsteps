import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { BODY_PARTS } from "./BodySegSupport";
import { getCameraStream } from "./CameraSupport";

interface CharacterCameraProps {
  stream: MediaStream | undefined;
  setStream: Dispatch<SetStateAction<MediaStream | undefined>>;
  video: HTMLVideoElement | null;
  setVideo: Dispatch<SetStateAction<HTMLVideoElement | null>>;
  onAspectChange: Dispatch<SetStateAction<number | undefined>>;
  colorKey: boolean;
}

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
