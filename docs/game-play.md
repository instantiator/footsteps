# Playing a game

A game has a landing page, a play page, and a JSON debug page. The landing page checks permissions
and offers New game or Continue; the play page runs the game, saves progress, and keeps the screen
awake while the game is incomplete.

## Routes

| Route            | What it shows                             |
| ---------------- | ----------------------------------------- |
| `/`              | The list of games in the local repository |
| `/game/:id`      | The game's landing page                   |
| `/game/:id/play` | The game itself                           |
| `/game/:id/json` | The game's resolved JSON, for debugging   |

The three game routes are prerendered for every game in `public/game-repository.json`. A direct visit
to `/game/:id/play` checks the game's required permissions first and sends the player back to the
landing page if one is missing.

## Landing page

The landing page fills the viewport with the game's `tileGraphic`, falling back to a plain pale blue
background when the game names no graphic. The game's title and description sit in the same
translucent panel style as the home-page tiles, and the page uses the game's
`gameContainerStyle.fontFamily`.

Below the description is a permissions panel. At the bottom right are the game controls:

- **New game** always appears. It clears this game's saved progress and starts a fresh game.
- **Continue** appears only when valid saved progress exists, and resumes it.

Both buttons stay disabled until every required permission has been granted and the initial checks
have finished.

## Permissions

A game needs the camera permission when either:

- `modules.camera.enabled` is `true`, or
- any overview, stage `shared`, or challenge display sets `camera.enabled: true`.

The landing page asks the browser for each required permission with
`navigator.permissions.query({ name: "camera" })`. A granted permission gets a check mark. Once
checked, anything else gets a Grant button.

Granting calls `getUserMedia({ video: true })`, stops the returned tracks immediately, and checks
again. If the browser cannot report the camera permission (the Permissions API is missing or rejects
the name), the landing page still requires the Grant click. A successful request counts as granted
unless the browser reports it as denied.

The play route repeats the check so a bookmark or typed URL cannot skip the landing page. It allows
play when the permission is granted, and also when the browser cannot report the permission: in that
case the browser still enforces camera access when the game opens the camera. It redirects to the
landing page for `prompt` and `denied`.

## Saved progress

Progress is saved in `localStorage` under `footsteps:game-state:<gameId>`. The stored value is a
versioned projection, not the runtime `GameState`:

- the format version and game id;
- the solved challenge ids for each stage;
- the current stage and overview display.

On load, stage completion and sequential availability are rebuilt from the solved challenges. The
authored game data always comes from the current repository. The saved value is ignored when it is
corrupt, from another version or game, or refers to stages, challenges, or views the game no longer
has.

Every change after the initial state is saved. Opening a game and doing nothing does not create a
Continue entry. New game clears the key; Continue navigates to play and lets the play page load the
stored state.

The full rationale is in [ADR 0003](ADRs/0003-save-progress-in-local-storage.md).

## Keeping the screen awake

While a game is open, visible, and not complete, `useWakeLock` requests a screen wake lock with the
Screen Wake Lock API. It releases the lock when the game completes, the tab is hidden, or the game
unmounts, and reacquires it when the tab becomes visible again. The API is not available in every
browser; when it is missing or refuses the request, the game logs a warning and carries on without a
lock.

## Where the code lives

| Path                                               | What it does                                                 |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `src/pages/LocalGameLanding.tsx`                   | Loads the local repository and game for the landing route    |
| `src/components/landing/GameLanding.tsx`           | Landing layout, background, and New/Continue controls        |
| `src/components/landing/GamePermissionPanel.tsx`   | Permission list, states, and Grant buttons                   |
| `src/components/landing/useGamePermissions.ts`     | Checks, grants, and gates the landing controls               |
| `src/components/core/logic/GamePermissionUtils.ts` | Camera requirement scan, permission query, and request       |
| `src/components/core/GamePermissionGuard.tsx`      | Direct-play permission guard and landing redirect            |
| `src/entities/state/GameStateStorage.ts`           | Versioned local-storage projection, validation, and clearing |
| `src/providers/GameStateProvider.tsx`              | Loads saved progress and saves each change                   |
| `src/components/core/WakeLockHook.ts`              | Screen wake lock lifecycle                                   |
