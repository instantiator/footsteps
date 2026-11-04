import { createContext } from "react";
import { PlayerRegistry } from "../components/camera/PlayerRegistry";

/** What has happened to each player, for the game and its camera. A game provides its own. */
export const PlayerRegistryContext = createContext(new PlayerRegistry());
