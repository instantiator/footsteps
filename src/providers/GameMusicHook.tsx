import { useContext } from "react";
import { GameMusicContext } from "./GameMusicContext";

export default function useGameMusic() {
  return useContext(GameMusicContext);
}
