import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { useGameData } from "../../providers/GameDataHook";
import { checkGamePermission, requiredGamePermissions } from "./logic/GamePermissionUtils";

/** Where the guard has got to in checking the game's required permissions. */
type GuardState = "checking" | "allowed" | "blocked";

/** Holds the game back until its required permissions are granted, or sends the player to the landing page. */
export default function GamePermissionGuard({ children }: { children: ReactNode }) {
  const { gameId, gameData } = useGameData();
  const permissions = useMemo(() => requiredGamePermissions(gameData), [gameData]);
  const [state, setState] = useState<GuardState>(() => (permissions.length === 0 ? "allowed" : "checking"));

  useEffect(() => {
    if (permissions.length === 0) return;

    let cancelled = false;
    Promise.all(permissions.map(checkGamePermission)).then((states) => {
      if (cancelled) return;
      // Only a known grant lets play start; anything else goes back to the landing page to grant it
      setState(states.every((permission) => permission === "granted") ? "allowed" : "blocked");
    });
    return () => {
      cancelled = true;
    };
  }, [permissions]);

  if (state === "checking") return null;
  if (state === "blocked") return <Navigate to={`/game/${gameId}`} replace />;
  return <>{children}</>;
}
