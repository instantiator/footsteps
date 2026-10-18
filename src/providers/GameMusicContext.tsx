import { createContext } from "react";

export interface CurrentMusicContext {
  currentMusic:
    | {
        resource: string;
        audio: HTMLAudioElement;
      }
    | undefined;
  playMusic: (res: string) => boolean;
  stopMusic: () => void;
}

export const GameMusicContext = createContext<CurrentMusicContext>(undefined!);
