# Player tracking

How the game follows players, what can happen to them, and how they are restored. The [effects that act on players](special-effects.md#player-effects) are described with the other effects.

## How players are tracked

A vision model finds the people in each camera frame. `PersonTracker` (`src/vision/Tracking.ts`) matches them to the last frame by the nearest silhouette centre, and gives each a tracker id. `PlayerRegistry` (`src/components/camera/PlayerRegistry.ts`) then gives each a stable player id and a number, and remembers what has happened to them.

Each player has their own canvas in their own wrapper, kept by player id. Depth, effects and the `.player` classes go on the wrapper, and mirroring stays on the canvas, so an effect can rotate a player about their body without disturbing the mirroring. A hidden canvas stays in place as the reference that everything is measured against, so a falling player doesn't move it.

## Player numbers

Tracker ids only ever grow, so each tracked person also takes the lowest free number from 1, keeps it while they are known, and frees it when they go. `N` in `.player-N`, and `event.player`, are this number. `event.player` is `0` when no player fired the rule.

## Choosing players

| Value                    | Meaning                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `"triggering"` (default) | The player who fired the rule. On a rule no player fired (eg. `when` or `every`), the effect does nothing, and this logs a warning. |
| `"all"`                  | Every player. Each effect applies to those it can: a removed player only responds to `player-restore`.                              |

## States

| State   | Meaning                                                                                         | Drawn                             | Interacts | Counted as active |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------- | --------- | ----------------- |
| Active  | In play. Includes `player-invisible` and `player-static`, which only change how they are drawn. | Yes                               | Yes       | Yes               |
| Leaving | A `player-fall` or `player-spin-away` is running.                                               | Yes, frozen and moving off-screen | No        | Yes               |
| Frozen  | A `player-freeze` has applied, until `player-unfreeze`.                                         | Yes, frozen in place              | No        | Yes               |
| Removed | The effect has finished, and they are off-screen.                                               | No                                | No        | No                |

Leaving players count as active until they are off-screen, so a rule that resets the scene when nobody is left lets the last fall finish.

## Counting players

| Expression             | Meaning                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `game.players.active`  | Players in shot and not removed. A player the model has lost for a moment, and is still holding, counts.                 |
| `game.players.removed` | Players removed since their scene last reset.                                                                            |
| `game.players.frozen`  | Players frozen now. They also count as active. A frozen player who starts to fall or spin away stops counting as frozen. |

```json
{
  "on": { "when": "game.players.active == 0 and game.players.removed > 0", "forMs": 500 },
  "do": [{ "resetChallenge": true }]
}
```

Check `removed` too, as `active` is also 0 before anyone has walked into shot, or when everyone has walked out. Everyone being frozen is `game.players.active > 0 and game.players.frozen == game.players.active`.

The counts are in `GameState.session`, so aren't saved, and change only when they need to, as a game state update re-renders the game.

## Restoring

Everyone is restored, whatever has happened to them, when the game moves to another scene, so nobody misses the next challenge. That is true even when a stage's shared scene stays showing.

When a scene resets (see [ending with the scene](special-effects.md#ending-with-the-scene)), the players its rules have affected are restored. With challenges side by side, one resetting doesn't revive a player removed by the other. A scene and its own reset scene showing in turn count as a reset.

To opt out, a scene component sets `keepRemovedPlayers`:

| Property             | Type    | Default | Meaning                                              |
| -------------------- | ------- | ------- | ---------------------------------------------------- |
| `keepRemovedPlayers` | boolean | `false` | Whether players stay removed when this scene resets. |

It is read from the scene being reset, even as its reset scene shows. It keeps only removed players: one on the way there goes straight there, and frozen, invisible and static players return to normal. Moving to another scene restores them anyway.

A rule can restore players at any time with [`player-restore`](special-effects.md#restore).

## When the tracker loses a player

A removed or frozen state lasts much longer than the tracker follows anyone, so it needs more than a tracker id:

- Someone unseen for over 500 ms (or the hold and fade time, if longer) comes back from the tracker with a new id.
- Each tracking loop has a new `PersonTracker`, whose ids restart from 0.

So when the tracker loses a player who isn't active, the registry keeps a note of where they were. A new person appearing within a quarter of the frame's width of there inherits the note, and with it the player's id, number and state. A frozen player stays drawn and counted while noted. A leaving player finishes leaving, and stays as a removed note. Notes last until the player's scene resets or they are restored.

## Limits

These are hard to fix without recognising people by appearance:

- **Players who cross can swap**, moving a removal or a freeze to the wrong person, as people are matched by the nearest silhouette centre.
- **Walking out of shot and back rejoins** as someone new, unless near a note. A stranger who walks through a note's place inherits it instead.
- **A delayed `"triggering"` effect finds its player by number**, so if they have left and their number has been reused by then, it reaches the new holder.
- **Player effects need `visionSmoothing` on.** Without it, an id is only a person's place in the frame's list. They do nothing, and log one warning.

These need real people in front of a real camera to judge, so they are in [manual testing](testing/manual-testing.md#player-effects).
