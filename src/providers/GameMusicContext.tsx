import { createContext } from "react";

/** Plays one music track at a time. */
export interface CurrentMusicContext {
  /** The track now playing, if any. */
  currentMusic:
    | {
        resource: string;
        audio: HTMLAudioElement;
      }
    | undefined;
  /** Starts the track at the given URL, unless music is already playing. @returns whether playback was attempted */
  playMusic: (res: string) => boolean;
  /** Stops the current music, if any. */
  stopMusic: () => void;
}

/** The music controls; see {@link GameMusicProvider}. */
export const GameMusicContext = createContext<CurrentMusicContext>(undefined!);
