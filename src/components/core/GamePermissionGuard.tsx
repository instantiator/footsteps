import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { useGameData } from "../../providers/GameDataHook";
import { loadCameraChoice } from "../camera/CameraChoice";
import { cameraKeyOf } from "../camera/FloorCalibration";
import {
  calibrationNeeded,
  checkGamePermission,
  gameUsesFloor,
  requiredGamePermissions,
  usedGamePermissions,
} from "./logic/GamePermissionUtils";

/** Where the guard has got to in checking the game's required permissions. */
type GuardState = "checking" | "allowed" | "blocked";

/**
 * Holds the game back until its required permissions are granted, and until the floor is calibrated for a game with
 * 2.5D scenes played by camera, or sends the player to the landing page. Direct links skip the landing page's checks.
 */
export default function GamePermissionGuard({ children }: { children: ReactNode }) {
  const { gameId, gameData } = useGameData();
  const permissions = useMemo(() => requiredGamePermissions(gameData), [gameData]);
  // A camera the game can do without still needs a floor, if the player has granted it
  const checkFloor = useMemo(
    () => gameUsesFloor(gameData) && usedGamePermissions(gameData).includes("camera"),
    [gameData],
  );
  const needsChecks = permissions.length > 0 || checkFloor;
  const [state, setState] = useState<GuardState>(() => (needsChecks ? "checking" : "allowed"));

  useEffect(() => {
    if (!needsChecks) return;

    let cancelled = false;
    const camera = checkFloor ? checkGamePermission("camera") : Promise.resolve(undefined);
    Promise.all([Promise.all(permissions.map(checkGamePermission)), camera]).then(([states, cameraState]) => {
      if (cancelled) return;
      // Only a known grant lets play start; anything else goes back to the landing page to grant it
      const granted = states.every((permission) => permission === "granted");
      const uncalibrated = calibrationNeeded(gameData, cameraState === "granted", cameraKeyOf(loadCameraChoice()));
      setState(granted && !uncalibrated ? "allowed" : "blocked");
    });
    return () => {
      cancelled = true;
    };
  }, [permissions, checkFloor, needsChecks, gameData]);

  if (state === "checking") return null;
  if (state === "blocked") return <Navigate to={`/game/${gameId}`} replace />;
  return <>{children}</>;
}
