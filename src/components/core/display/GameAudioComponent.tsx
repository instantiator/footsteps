import { useId, useRef, useState } from "react";
import type { GameDisplayMediaData } from "../../../entities/data/displays/GameDisplayMediaData";
import { useGameData } from "../../../providers/GameDataHook";
import useGameMusic from "../../../providers/GameMusicHook";
import { isDefined } from "../../../util/ObjectUtils";

interface GameAudioComponentProps {
  media: GameDisplayMediaData;
  controls: boolean;
  audioStyle?: React.CSSProperties;
}

export default function GameAudioComponent({ media, controls, audioStyle }: GameAudioComponentProps) {
  const { resources } = useGameData();
  const { stopMusic } = useGameMusic();

  const uid = useId();

  const [mediaPlaying, setMediaPlaying] = useState(false);
  const handlePlay = () => setMediaPlaying(true);
  const handlePause = () => setMediaPlaying(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <>
      {!mediaPlaying && isDefined(media.stillImageResource) && (
        <img
          src={resources[media.stillImageResource]}
          style={{
            height: "20vh",
            margin: "10px",
            animation: "floatAndZoom 3s ease-in-out infinite alternate",
            filter: "drop-shadow(8px 8px 10px rgba(0, 0, 0, 0.5))",
          }}
          onClick={() => {
            if (isDefined(audioRef.current)) {
              stopMusic();
              audioRef.current.play();
            }
          }}
        />
      )}
      {mediaPlaying && isDefined(media.motionImageResource) && (
        <img
          src={resources[media.motionImageResource]}
          alt={`Playing ${media.audioDescription}`}
          style={{
            height: "20vh",
            margin: "10px",
            animation: "floatAndZoom 3s ease-in-out infinite alternate",
            filter: "drop-shadow(8px 8px 10px rgba(0, 0, 0, 0.5))",
          }}
          onClick={() => {
            if (isDefined(audioRef.current)) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
          }}
        />
      )}
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
