import { useId, useRef, useState } from "react";
import type { GameDisplayMediaData } from "../../../entities/data/displays/GameDisplayMediaData";
import { useGameData } from "../../../providers/GameDataHook";
import useGameMusic from "../../../providers/GameMusicHook";
import { isDefined } from "../../../util/ObjectUtils";

/** Props for {@link GameAudioComponent}. */
interface GameAudioComponentProps {
  /** The audio resource, with optional still and motion images. */
  media: GameDisplayMediaData;
  /** Whether to show the browser's own audio controls. */
  controls: boolean;
  /** Style for the audio element's controls. */
  audioStyle?: React.CSSProperties;
}

/** Style for the still and motion images: floating, with a drop shadow. */
const IMAGE_STYLE: React.CSSProperties = {
  height: "20vh",
  margin: "10px",
  animation: "floatAndZoom 3s ease-in-out infinite alternate",
  filter: "drop-shadow(8px 8px 10px rgba(0, 0, 0, 0.5))",
};

/** An audio clip, optionally shown as a still image to click to play, and an animated one to click to stop. */
export default function GameAudioComponent({ media, controls, audioStyle }: GameAudioComponentProps) {
  const { resources } = useGameData();
  const { stopMusic } = useGameMusic();

  const uid = useId();
  const description = media.audioDescription ?? "audio";

  const [mediaPlaying, setMediaPlaying] = useState(false);
  const handlePlay = () => setMediaPlaying(true);
  const handlePause = () => setMediaPlaying(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <>
      {!mediaPlaying && isDefined(media.stillImageResource) && (
        <button
          type="button"
          className="plain-button"
          aria-label={`Play ${description}`}
          onClick={() => {
            if (isDefined(audioRef.current)) {
              stopMusic();
              audioRef.current.play();
            }
          }}
        >
          <img src={resources[media.stillImageResource]} alt="" style={IMAGE_STYLE} />
        </button>
      )}
      {mediaPlaying && isDefined(media.motionImageResource) && (
        <button
          type="button"
          className="plain-button"
          aria-label={`Stop ${description}`}
          onClick={() => {
            if (isDefined(audioRef.current)) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
          }}
        >
          <img src={resources[media.motionImageResource]} alt="" style={IMAGE_STYLE} />
        </button>
      )}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- game media data has no captions yet: see docs/outstanding-issues.md */}
      <audio
        ref={audioRef}
        key={`audio-${media.resource}-${uid}`}
        controls={controls}
        style={{ fontFamily: "inherit", fontSize: "inherit", ...audioStyle }}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
      >
        <source src={resources[media.resource]} />
        Your browser does not support the audio element.
      </audio>
    </>
  );
}
