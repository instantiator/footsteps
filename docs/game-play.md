# Playing a game

A game has a landing page, a play page, and a JSON debug page. The landing page checks permissions
and offers New game or Continue; the play page runs the game, saves progress, and keeps the screen
awake while the game is incomplete, with a warning on every page when the battery is low.

## Routes

| Route                 | What it shows                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                   | The [home page](#home-page): the local repository's games, setup and design, and attributions        |
| `/game/:id`           | The game's landing page                                                                              |
| `/game/:id/play`      | The game itself                                                                                      |
| `/game/:id/calibrate` | [Floor calibration](camera-mode.md#calibrating-the-floor) for the chosen camera                      |
| `/game/:id/json`      | The game's resolved JSON, for debugging                                                              |
| `/scene-renderer`     | A scene's HTML rendered in 2.5D, for game authors ([scene renderer](dev-overview.md#scene-renderer)) |
| `/setup`              | [Plans the space](camera-mode.md#planning-the-space): floor size and where to put the camera         |
| `/dependencies`       | The app's dependencies and their licences, from `src/assets/license-report.json`                     |

The game routes are prerendered for every game in `public/game-repository.json`. A direct visit
to `/game/:id/play` checks the game's required permissions first, and for a game with 2.5D scenes played by camera,
that the floor is calibrated. It sends the player back to the landing page if either is missing.

## Home page

The home page fits the window. Under the 👣 Footsteps title are three tabs, and only the chosen tab's panel scrolls
when its content is long:

- **Local repository:** a tile for each game in the local repository. A tile glows under the pointer or the
  keyboard's focus.
- **Setup and design:** Plan your space (`/setup`) and the Scene designer (`/scene-renderer`).
- **Attributions:** a link to the dependencies and their licences (`/dependencies`), then each game's credits.

The URL hash records the chosen tab (`#local-repository`, `#setup-and-design`, `#attributions`), so a reload or a
shared link opens it. Changing tab replaces the hash rather than adding to the history. The arrow keys, Home and End
move between the tabs. The footer says that Footsteps is open source under the MIT license, with links to the licence
and the GitHub repository. With `?debug=true`, it also shows the site's base path.

## Landing page

The landing page fills the viewport with the game's `tileGraphic`, falling back to a plain pale blue
background when the game names no graphic, and uses the game's `gameContainerStyle.fontFamily`. Its panels use the
same translucent style as the home-page tiles, in two columns that each scroll in the space above a bar of buttons
(stacked, and scrolling together, on narrow screens):

- **On the left**, the game's title, its [badges](#badges) and its description.
- **On the right**, if the game uses the camera, the permissions panel and the **Camera configuration** panel: the
  [camera and configuration choice](camera-mode.md#choosing-a-camera), with a live preview. The panel takes the rest
  of its column, and the preview is as large as fits in it, in the camera's shape. What's still needed
  before the game can begin shows over the preview: "Camera required" while a required camera isn't granted, and
  "Not yet calibrated" for a game with [2.5D scenes](game-data.md#scene-and-avatar-modes) until the chosen
  configuration's floor is [calibrated](camera-mode.md#calibrating-the-floor). To the right of
  the preview (under it on a narrow screen), **Reset** saves the default floor for that configuration, **Clear**
  forgets it, and **Calibrate** calibrates it.

The bar along the bottom has:

- **Back to games**, on the far left, which returns to the home page's list of games.
- **Plan space**, which opens the [setup planner](camera-mode.md#planning-the-space) in a new tab.
- **Clear all calibrations**, for a game with 2.5D scenes, which forgets every camera configuration's floor after
  asking.
- **Continue**, only when valid saved progress exists, which resumes it.
- **New game**, which clears this game's saved progress and starts a fresh game, after asking first if there is
  saved progress to lose.

Both start buttons stay disabled until the initial checks have finished, until every permission the game requires
has been granted, and, with the camera granted, until the chosen configuration's floor is calibrated for a game with
2.5D scenes.

A game whose camera is optional also offers **Play without the camera** in the camera dropdown. Chosen, the game
starts at `/game/:id/play?noCamera=true` (the [`noCamera`](configuration.md) setting): the camera stays off even where
it is available, each scene plays in its [fallback mode](game-data.md#scene-and-avatar-modes), and the floor needn't
be calibrated. It's for playing, or testing, by mouse.

### Badges

Each game's tile on the home page, and its landing page, show badges worked out from its data and saved progress, so
authors never write them:

| Badge       | Shows                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene modes | `2D`, `2.5D`, or both: every scene's `scene` and the game's own, or `2D` if none says                                                         |
| Camera      | **Camera** if a scene needs it (`camera` with no `fallback`), **Camera optional** if one uses it with a fallback, or **No camera**            |
| Size        | Its number of stages and challenges, eg. "3 stages · 4 challenges"                                                                            |
| Progress    | "% complete": the share of its challenges solved, only when there is a saved game                                                             |
| Sound       | **Music** (an opening or closing music resource), **Sound effects** (a stage sound resource, or a rule's `sound` action), both, or **Silent** |

The code is `gameBadges` in `src/components/core/logic/GameBadgeUtils.ts`, shown by `GameBadges`.

## Permissions

A game uses the camera when `modules.avatar`, or the `avatar` of any overview, stage `shared`, challenge or reset
scene, has `mode: "camera"`. It requires the camera when any of them has `mode: "camera"` with no `fallback`.
A game that doesn't use the camera shows no permissions panel.

The landing page asks the browser for each permission the game uses with
`navigator.permissions.query({ name: "camera" })`. A granted permission gets a check mark. Once
checked, anything else gets a Grant button.

Granting calls `getUserMedia({ video: true })`, stops the returned tracks immediately, and checks
again. A successful request is remembered for the tab in `sessionStorage`, and counts as granted
unless the browser later reports it as denied. So a browser that cannot report the camera permission
(the Permissions API is missing or rejects the name) needs one Grant click per tab.

The play route repeats the check for a required permission, so a bookmark or typed URL cannot skip the landing page.
It allows play only when the permission is granted (including a grant remembered for the tab), and redirects to
the landing page otherwise. A game that only enables the camera can start without a grant. The browser asks when the
first camera scene appears, and if the player refuses, the game plays on by clicks.

## Saved progress

Progress is saved in `localStorage` under `footsteps:game-state:<gameId>`. The stored value is a
versioned projection, not the runtime `GameState`:

- the format version and game id;
- the solved challenge ids for each stage;
- the current stage and overview scene.

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
unmounts, and reacquires it when the tab becomes visible again, or when the browser releases it
while the tab is still visible (for example on entering a battery saver mode). The API is not
available in every browser; when it is missing or refuses the request, the game logs a warning and
carries on without a lock.

## Low battery warning

`BatteryWarning`, rendered by the root route, shows a banner on every page when the battery is at or
below 20% and not charging, so a game isn't cut short by the device shutting down. It uses the
Battery Status API, which only Chromium browsers (Chrome, Edge, Android) provide; elsewhere it shows
nothing.

## The HUD

The HUD sits at the top right of every game, over the scenes, kept small so it covers little of them: **Menu**,
**Close challenge** (while a stage is open), **To title** (when the game has a title screen that isn't showing), and
**Full screen**. Menu opens a panel below it, which closes again after any of its actions:

| Control                  | What it does                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Go to** and **Go**     | Goes to the catalogue of games, the game's landing page, its title screen and stages overview (if it has them), or any stage or challenge. Completed (✓) and locked (🔒) stages and challenges can't be picked. |
| **Reset** and **Reset**  | Lists each solved challenge (✓), and makes the picked one playable again. Disabled while nothing is solved.                                                                                                     |
| **Debug on / Debug off** | Switches the [debug aids](camera-mode.md#debugging). They start as the [`debug` setting](configuration.md) says.                                                                                                |

Stages and challenges have no names of their own in game data, so Go to numbers them: `Stage: 2`, and under it
`Challenge: 2.1`. Going to a challenge opens its stage showing that challenge (with any shown alongside it, if the
stage shows several at once), even if earlier ones are unsolved. Once those are solved, or the stage closes, the stage
goes back to showing its challenges in order. Resetting a challenge is the same as a rule's `resetChallenge`: it is
unsolved again, its stage's completion follows, and its scenes and reset scenes start afresh. A stage it unlocked stays
unlocked.

## Where the code lives

| Path                                               | What it does                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/pages/LocalGameLanding.tsx`                   | Loads the local repository and game for the landing route                            |
| `src/components/landing/GameLanding.tsx`           | Landing layout, and the Continue and New game controls                               |
| `src/components/landing/GameBadges.tsx`            | A game's badges, on its tile and landing page                                        |
| `src/components/core/logic/GameBadgeUtils.ts`      | Works out the badges from the game's data and saved progress                         |
| `src/components/landing/GamePermissionPanel.tsx`   | Permission list, states, and Grant buttons                                           |
| `src/components/landing/CameraPicker.tsx`          | Camera and configuration dropdowns, mirror checkbox, live preview, and floor buttons |
| `src/components/landing/ButtonBar.tsx`             | The bar of buttons along the bottom of the landing and calibration pages             |
| `src/components/landing/PlanSpaceLink.tsx`         | **Plan space**: the setup planner for the camera in use, in a new tab                |
| `src/components/landing/PictureWarnings.tsx`       | What's still needed, over a camera picture                                           |
| `src/components/landing/ClearAllCalibrations.tsx`  | **Clear all calibrations**, after asking                                             |
| `src/components/landing/GamePageStyle.ts`          | A game's background and font, for its landing and calibration pages                  |
| `src/components/landing/useGamePermissions.ts`     | Checks, grants, and gates the landing controls                                       |
| `src/components/core/logic/GamePermissionUtils.ts` | Camera requirement scan, permission query, and request                               |
| `src/components/core/GamePermissionGuard.tsx`      | Direct-play permission guard and landing redirect                                    |
| `src/entities/state/GameStateStorage.ts`           | Versioned local-storage projection, validation, and clearing                         |
| `src/providers/GameStateProvider.tsx`              | Loads saved progress and saves each change                                           |
| `src/components/core/WakeLockHook.ts`              | Screen wake lock lifecycle                                                           |
| `src/components/core/HeadsUpDisplay.tsx`           | The HUD's controls                                                                   |
| `src/components/core/logic/HudNavigation.ts`       | What Go to and Reset offer, and where each entry leads                               |
| `src/components/core/BatteryWarning.tsx`           | Low-battery banner on every page                                                     |
