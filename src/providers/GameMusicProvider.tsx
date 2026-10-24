import { useEffect, useRef, useState } from "react";
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

/** A track that is playing. */
type PlayingMusic = NonNullable<Awaited<ReturnType<typeof playAudio>>>;

/**
 * Provides game music, one track at a time. Only the latest request plays, and the music stops
 * when the game unmounts, since its audio isn't part of the page.
 */
export default function GameMusicProvider({ children }: { children: React.ReactNode }) {
  const [currentMusic, setCurrentMusic] = useState<PlayingMusic | undefined>(undefined);
  // Read by requests in flight, which outlive the render that made them
  const currentRef = useRef<PlayingMusic | undefined>(undefined);
  const latestRequest = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      currentRef.current?.audio.pause();
    };
  }, []);

  /** Records a track as current, until it pauses or ends while still current. */
  const adopt = (playing: PlayingMusic) => {
    currentRef.current = playing;
    setCurrentMusic(playing);
    const clear = () => {
      if (currentRef.current?.audio === playing.audio) currentRef.current = undefined;
      setCurrentMusic((current) => (current?.audio === playing.audio ? undefined : current));
    };
    playing.audio.addEventListener("pause", clear);
    playing.audio.addEventListener("ended", clear);
  };

  const playMusic = (res: string) => {
    const request = ++latestRequest.current;
    const isLatest = () => mounted.current && request === latestRequest.current;
    const previous = currentRef.current;
    const fading = isDefined(previous) ? fadeOut(previous.audio) : Promise.resolve();
    void fading
      .then(() => (isLatest() ? playAudio(res) : undefined))
      .then((playing) => {
        if (!isDefined(playing)) return;
        if (isLatest()) adopt(playing);
        else playing.audio.pause(); // superseded, or the game has gone, while it started
      });
  };

  /** Stops the currently playing music. The 'pause' listener will clear the current track. */
  const stopMusic = () => {
    currentRef.current?.audio.pause();
  };

  return (
    <GameMusicContext.Provider value={{ currentMusic, playMusic, stopMusic }}>{children}</GameMusicContext.Provider>
  );
}
