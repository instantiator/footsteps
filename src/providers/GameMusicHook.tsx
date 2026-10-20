import { useContext } from "react";
import { GameMusicContext } from "./GameMusicContext";

/** The music controls: {@link CurrentMusicContext}. */
export default function useGameMusic() {
  return useContext(GameMusicContext);
}
