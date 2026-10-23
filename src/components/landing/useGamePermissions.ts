import { useEffect, useMemo, useState } from "react";
import type { GameData } from "../../entities/data/GameData";
import {
  checkGamePermission,
  requestGamePermission,
  requiredGamePermissions,
  type GamePermissionId,
  type GamePermissionState,
} from "../core/logic/GamePermissionUtils";

/** The permissions a game requires, and the UI state for checking and granting them. */
interface GamePermissions {
  /** The permissions the game requires. */
  permissions: GamePermissionId[];
  /** Each permission's last known browser state, once checked. */
  states: Partial<Record<GamePermissionId, GamePermissionState>>;
  /** The permission currently being requested, if any. */
  granting: GamePermissionId | null;
  /** Requests a permission from the browser. */
  grant: (id: GamePermissionId) => void;
  /** Whether every required permission is granted and the initial checks have finished. */
  allGranted: boolean;
}

/** Checks the permissions a game requires, and grants them when the player asks. */
export const useGamePermissions = (gameData: GameData): GamePermissions => {
  const permissions = useMemo(() => requiredGamePermissions(gameData), [gameData]);
  const [states, setStates] = useState<Partial<Record<GamePermissionId, GamePermissionState>>>({});
  const [checking, setChecking] = useState(permissions.length > 0);
  const [granting, setGranting] = useState<GamePermissionId | null>(null);

  useEffect(() => {
    if (permissions.length === 0) return;

    let cancelled = false;
    Promise.all(permissions.map(async (id) => ({ id, state: await checkGamePermission(id) }))).then((entries) => {
      if (cancelled) return;
      const checked: Partial<Record<GamePermissionId, GamePermissionState>> = {};
      for (const entry of entries) checked[entry.id] = entry.state;
      setStates(checked);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [permissions]);

  const grant = (id: GamePermissionId) => {
    setGranting(id);
    void requestGamePermission(id).then((state) => {
      setStates((current) => ({ ...current, [id]: state }));
      setGranting(null);
    });
  };

  const allGranted = !checking && permissions.every((id) => states[id] === "granted");
  return { permissions, states, granting, grant, allGranted };
};
