# ADR 0003: Save game progress in local storage

- Status: Accepted
- Date: 2026-10-23

## Context

The landing page offers New game and Continue, so a game's progress has to survive a reload. The
runtime `GameState` contains the full authored `GameData`, resolved resources, display definitions
and challenge solutions. It is large, contains objects that are not meaningful across a reload, and
would break whenever a game's authored data changes.

The options were:

- `sessionStorage`: survives reloads in one tab, but not closing the tab.
- `localStorage`: synchronous, small, available in every browser, and survives closing the browser.
- IndexedDB: asynchronous and much larger, but needs a schema and an upgrade path for a few
  booleans per game.
- A server: the app is a static site, and there is no account or backend.

Progress is also only a few challenge ids and a current view per game, so the full state is not
needed.

## Decision

1. **Use `localStorage`, one key per game:** `footsteps:game-state:<gameId>`.
2. **Store a versioned projection, not `GameState`:** the format holds a version, the game id, the
   solved challenge ids for each stage, and the current stage and overview display.
3. **Rebuild the runtime state on load:** stage completion is derived from solved challenges, and
   sequential availability is derived from the first incomplete stage. The authored `GameData` and
   challenge definitions always come from the current repository.
4. **Validate strictly before use:** the version and game id must match, every stage and challenge id
   must still exist, and the current view must be valid for the current game. Invalid or stale
   progress is ignored, and New game clears it.
5. **Save every change, but not the initial state:** `GameStateProvider` skips the state it started
   with, so merely opening a game does not create a Continue entry. Every later `setGameState`
   writes the projection.
6. **Continue is a navigation, not a second load path:** the play route always loads saved progress
   when it mounts. New game clears the key first; Continue leaves it alone.

## Consequences

- Progress survives reloads and browser restarts on one device, with no backend.
- The stored value is small: one array of solved challenge ids per stage, plus the current view.
- Changing a game's stage or challenge ids can discard saved progress. That is deliberate: applying
  a projection to a different game structure would be guesswork.
- The format needs a migration if its shape changes. Bump the version and either migrate the old
  projection or accept that old progress is ignored.
- `localStorage` is synchronous and limited to about 5 MB per origin. The projection is far below
  that; a save failure is logged and does not interrupt play.
- Progress is per browser and per game, not per account, and is not synced across devices.
- The projection stores only challenge success and the current view. It does not store camera
  permission (the browser owns that), music state, or in-flight transitions.
