import { useState } from "react";
import { playAudio } from "../components/core/sfx/AudioUtils";
import { isDefined } from "../util/ObjectUtils";
import { GameMusicContext } from "./GameMusicContext";

/** How long the current track takes to fade out when another replaces it. */
const FADE_OUT_MS = 1000;
/** Volume steps in a fade-out. */
const FADE_OUT_STEPS = 20;

/**
 * Fades a track to silence, then pauses it and restores its volume for any later replay.
 * Browsers that ignore `volume` (iOS Safari) just pause it at the end.
 */
const fadeOut = (audio: HTMLAudioElement): Promise<void> =>
  new Promise((resolve) => {
    const startVolume = audio.volume;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      audio.volume = startVolume * (1 - step / FADE_OUT_STEPS);
      if (step < FADE_OUT_STEPS) return;
      clearInterval(timer);
      audio.pause();
      audio.volume = startVolume;
      resolve();
    }, FADE_OUT_MS / FADE_OUT_STEPS);
  });

/** Provides game music, one track at a time. */
export default function GameMusicProvider({ children }: { children: React.ReactNode }) {
  const [currentMusic, setCurrentMusic] = useState<{ resource: string; audio: HTMLAudioElement } | undefined>(
    undefined,
  );

  const playMusic = (res: string) => {
    const previous = isDefined(currentMusic) ? fadeOut(currentMusic.audio) : Promise.resolve();
    previous
      .then(() => playAudio(res))
      .then((playing) => {
        if (!isDefined(playing)) return;
        setCurrentMusic(playing);
        // Only clear the track if it is still current: a replaced track pauses after its successor starts
        const clear = () => setCurrentMusic((current) => (current?.audio === playing.audio ? undefined : current));
        playing.audio.addEventListener("pause", clear);
        playing.audio.addEventListener("ended", clear);
      });
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
