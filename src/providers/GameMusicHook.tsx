import { useContext } from "react";
import { GameMusicContext } from "./GameMusicContext";

/** The music controls: `CurrentMusicContext`. */
export default function useGameMusic() {
  return useContext(GameMusicContext);
}
