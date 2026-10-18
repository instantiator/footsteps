import { useState } from "react";
import { playAudio } from "../components/core/sfx/AudioUtils";
import { isDefined } from "../util/ObjectUtils";
import { GameMusicContext } from "./GameMusicContext";

export default function GameMusicProvider({ children }: { children: React.ReactNode }) {
  const [currentMusic, setCurrentMusic] = useState<{ resource: string; audio: HTMLAudioElement } | undefined>(
    undefined,
  );

  /** Music tracks should not play over each other - this tracks and checks */
  const playMusic = (res: string) => {
    if (!isDefined(currentMusic)) {
      playAudio(res).then((playing) => {
        if (isDefined(playing)) {
          setCurrentMusic(playing);
          playing.audio.addEventListener("pause", () => {
            setCurrentMusic(undefined);
          });
          playing.audio.addEventListener("ended", () => {
            setCurrentMusic(undefined);
          });
        }
      });
      return true; // attempted playback
    } else {
      return false; // already playing something
    }
  };

  /** Stops the currently playing music. The 'pause' listener will clear the currentMusic state. */
  const stopMusic = () => {
    if (isDefined(currentMusic)) {
      currentMusic.audio.pause();
    }
  };

  return (
    <GameMusicContext.Provider value={{ currentMusic, playMusic, stopMusic }}>{children}</GameMusicContext.Provider>
  );
}
