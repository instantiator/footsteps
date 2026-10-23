import {
  gamePermissionLabel,
  type GamePermissionId,
  type GamePermissionState,
} from "../core/logic/GamePermissionUtils";

/** Props for {@link GamePermissionPanel}. */
interface GamePermissionPanelProps {
  /** The permissions the game needs. */
  permissions: GamePermissionId[];
  /** Each permission's last known browser state, once checked. */
  states: Partial<Record<GamePermissionId, GamePermissionState>>;
  /** The permission currently being requested, if any. */
  granting: GamePermissionId | null;
  /** Requests a permission from the browser. */
  onGrant: (id: GamePermissionId) => void;
}

/** The landing page's permissions panel: each required permission, its state, and a way to grant it. */
export default function GamePermissionPanel({ permissions, states, granting, onGrant }: GamePermissionPanelProps) {
  if (permissions.length === 0) {
    return (
      <div className="game-panel game-landing-panel">
        <p>No permissions needed.</p>
      </div>
    );
  }

  return (
    <div className="game-panel game-landing-panel">
      <h2>Permissions</h2>
      <ul className="game-permission-list">
        {permissions.map((id) => {
          const state = states[id];
          const label = gamePermissionLabel(id);
          return (
            <li key={id}>
              <span>{label}</span>
              {state === "granted" ? (
                <span className="game-permission-granted" role="img" aria-label="Granted">
                  ✓
                </span>
              ) : state === undefined ? (
                <span className="game-permission-status">Checking…</span>
              ) : (
                <>
                  <span className="game-permission-status">Not granted</span>
                  <button
                    type="button"
                    aria-label={`Grant ${label.toLowerCase()}`}
                    onClick={() => onGrant(id)}
                    disabled={granting === id}
                  >
                    {granting === id ? "Requesting…" : "Grant"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
