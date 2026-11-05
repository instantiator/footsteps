# Special effects

How a game makes things shake, fall, move, pulse and celebrate. Effects are [rule actions](game-data.md#rules), so they fire on the same triggers as everything else. The rules demo's Effects stage (`public/games/rules-demo/effects.hbs`) has a worked example of each.

What happens to players is covered by the player effects below, and how players are followed by [player tracking](player-tracking.md).

## Coordinate system

The game uses one system for positions and distances.

| Measure                                 | Unit                                          | CSS equivalent |
| --------------------------------------- | --------------------------------------------- | -------------- |
| Horizontal position or distance         | % of the whole display's width, from the left | `cqw`          |
| Vertical position or distance           | % of the whole display's height, from the top | `cqh`          |
| A distance with no direction, or a size | % of the whole display's width                | `cqw`          |

**A position places the centre of the element.** CSS `left` and `top` place its corner, so `"end": { "left": 50, "top": 20 }` and `left: 50cqw; top: 20cqh` put an element in different places.

Positions mean the same at any scale, in any column of a stage's challenges, and whether or not the camera is mirrored, as mirroring only flips the players' canvases.

Use `cqw` and `cqh` to position items in template CSS too. `%` only matches in a template that fills the display, and with challenges side by side the parent is one column. Give highlight styles such as `shadow` in `cqw`, so they scale with the display. Other author-supplied lengths work in any CSS unit, but the same applies: `backgroundStyle`, `foregroundStyle`, `backgroundTemplateStyle`, `foregroundTemplateStyle`, `gameContainerStyle`, and `initialState` or `set` values used as positions in a template.

These measure something else, so they differ:

| Where                                        | Measures                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `threshold`                                  | The fraction of a body part inside an element.                                                                            |
| Dialog and scroll text margins               | A % of the dialog's image, as they position text on that image.                                                           |
| `jumpMinRise`, `jumpStill`, `jumpMinDescent` | A fraction of the player's height or rise, so a jump counts the same near or far from the camera. These are app settings. |
| `cameraDepthDeadband`, `cameraFeatherPx`     | A % of the scene's height, and pixels on the canvas. These are app settings too.                                          |

Two limits:

- **Inside a dialog or scroll**, `cqw` and `cqh` measure the dialog's own cell, as it is a size container. That is one column when challenges are side by side. Effects allow for this, but CSS in a dialog's template can't.
- **Each column has `overflow: hidden`**, so an item can't visibly move out of its own column, wherever a position puts it.

## Common properties

| Property     | Type                     | Meaning                                                                                |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------- |
| `effect`     | string                   | Which effect to run.                                                                   |
| `target`     | CSS selector             | The elements to apply it to. See [Targets](#targets).                                  |
| `durationMs` | `number \| "indefinite"` | How long it runs. See [Duration](#duration).                                           |
| `cycleMs`    | number                   | The length of one loop, when `durationMs` is `"indefinite"`.                           |
| `easing`     | CSS easing function      | How it speeds up and slows down.                                                       |
| `delayMs`    | number                   | How long to wait before starting, on any action. Defaults to `0`. See [Delay](#delay). |

These apply to every effect:

- **Bad values** are an error when the game loads, naming the rule: a negative time, an `easing` or `target` the browser can't parse, an effect that doesn't exist, or one of the mistakes listed under each effect.
- **Firing again:** an effect fired on an element or player already running the same effect restarts it. Different effects run together. A player already leaving ignores another `player-fall` or `player-spin-away`.
- **Reduced motion:** for players who prefer reduced motion, nothing moves. `quake` doesn't play. `item-fall`, `item-move`, `player-fall` and `player-spin-away` jump straight to their end. `player-static` shows, but doesn't flicker. Game state changes as it would otherwise, and `effectEnd` still fires, so these players can still finish the game.
- **Not saved:** effects and player states last for the session, like rewards. Reloading shows items where their templates put them.

### Ending with the display

Every effect and animation ends when its display closes or resets, except sounds and rewards: those playing or waiting on a `delayMs` carry on, as rules usually play them in the same step that closes the display. Items return to where the template puts them, and delays still waiting are cancelled.

A display resets when `resetState` or `resetChallenge` runs, a reset display shows, or a display with `resetStateOnShow` shows again. It then starts afresh: its template is rebuilt, so its CSS animations restart; its `every` and `after` timers restart; its `start` rules fire again; and its `when` rules begin again. A player already over one of its elements must move away and back. A `start` rule can't itself reset the display, which is an error when the game loads, as it would never stop. A display that resets itself more than 10 times in a second by some other route is logged and stopped.

A fallen item stays off-screen during the scene's fade as its display closes, rather than snapping back into view: it goes when the display does.

## Duration

| Effect                                                 | `"indefinite"` | One loop is                                  |
| ------------------------------------------------------ | -------------- | -------------------------------------------- |
| `quake`                                                | Allowed        | `cycleMs`                                    |
| `item-fall`                                            | Allowed        | `cycleMs`, then it starts again from the top |
| `item-move`                                            | Allowed        | `cycleMs`, then it starts again from `start` |
| `highlight`                                            | Allowed        | The length of its `sequence`                 |
| `player-static`                                        | Allowed        | Doesn't loop: it holds                       |
| `player-fall`, `player-spin-away`                      | Error on load  | They must finish, to remove the player       |
| `player-freeze`, `player-unfreeze`                     | Doesn't apply  | They have no duration, and apply at once     |
| `player-invisible`, `player-visible`, `player-restore` | Error on load  | They are one-way changes                     |

An indefinite effect ends with `stop`, or when its display closes or resets.

## Delay

Every action takes an optional `delayMs`.

```json
{
  "on": { "interact": ["jump-onto"], "target": "#bridge" },
  "do": [
    { "effect": "quake", "target": "#bridge", "dx": 0.5, "dy": 0.5, "durationMs": 400 },
    { "effect": "item-fall", "target": "#bridge", "delayMs": 400 },
    { "set": { "bridgeGone": "true" }, "delayMs": 1400 }
  ]
}
```

- A rule's `if` is checked when it fires, and not again after the delay.
- Later actions don't wait for a delayed one: each counts from when the rule fired.
- A delayed action's expressions are worked out when it runs, from the state at that time, using the `event` from when the rule fired.
- A delayed action is cancelled if its display closes or resets first, so a late `completeChallenge` or `set` can't change a display that has moved on. Sounds and rewards are the exception, as above.
- `delayMs` is a number, not an expression.

## Targets

A `target` looks inside the display whose rule fired, so two challenges side by side can use the same ids. It can also use these classes, which are outside any display:

| Class                         | Elements                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `.player`                     | Every player.                                                                                                                               |
| `.player-N` (eg. `.player-1`) | One player. See [player numbers](player-tracking.md#player-numbers). `N` is read as the effect starts, and it stays with that player.       |
| `.display-foreground`         | The display foreground containers: `#overview-foreground-container`, `#stage-foreground-container`, and `#challenges-foreground-container`. |
| `.display-background`         | The display background containers, named the same way.                                                                                      |

- **Items move, not layers.** An effect on `.display-foreground` or `.display-background`, or with no `target`, applies to each top-level item (`.templateBody > *`), never to a container. Moving a container would make it a stacking context, so items inside it could no longer sit between players.
- **Wrappers around depth items.** A top-level item holding `data-depth` items gives its children instead, recursively, for the same reason. A `target` that names one directly logs a warning, and those items can't sort among players during the effect.
- **Dialogs and scrolls** give their whole frame, keeping the image, text and controls together. A dialog's layers always share one motion, even with `consistentMotion: false`.
- **Missing elements:** a `target` matching nothing logs a warning. Effects wait up to 5 s for their display's elements to reach the screen first, as a display's state changes before its fade is over.
- **Give items an `id`.** An effect stays on its element through template re-renders, but an element without an `id` may be replaced by one.

An effect on an element can't be applied to everything a player's canvas does:

| Effect                                 | On `.player` or `.player-N` | Why                                                                                                                                 |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `reward`                               | Allowed                     | The burst uses the centre of their body.                                                                                            |
| `quake`                                | Allowed                     | The silhouette moves away from where interactions measure it, but only briefly.                                                     |
| `highlight` with `filter`              | Allowed                     | `brightness()` and `drop-shadow()` follow the silhouette. It redraws a display-sized filter each camera frame, so use it sparingly. |
| `highlight` with `shadow` or `outline` | Error on load               | These draw around the canvas's rectangle, which is the whole display. Use `filter: drop-shadow()`.                                  |
| `item-fall`                            | Error on load               | The silhouette would leave while the player stays active. Use `player-fall`.                                                        |
| `item-move`                            | Error on load               | The silhouette would move away from where the player is really interacting.                                                         |

## Item effects

These all default `target` to every item in the shown displays, which is rarely what you want for `item-fall` and `item-move`.

### Quake

```json
{
  "on": { "interact": ["jump-from"], "target": "#some-element" },
  "do": [{ "effect": "quake", "target": "#some-element", "dx": 1, "dy": 0, "durationMs": 1000, "easing": "ease-out" }]
}
```

Any jump shakes the whole scene, with each item moving differently:

```json
{
  "on": { "interact": ["jump"] },
  "do": [{ "effect": "quake", "dx": 0.5, "dy": 1, "consistentMotion": false }]
}
```

| Property           | Type                     | Default | Meaning                                                                                                                           |
| ------------------ | ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `dx`               | number                   | `0`     | How far to shake horizontally, as a % of the display's width.                                                                     |
| `dy`               | number                   | `0`     | How far to shake vertically, as a % of the display's height.                                                                      |
| `consistentMotion` | boolean                  | `true`  | Whether all items shake with the same motion. If `false`, each item's motion is random.                                           |
| `durationMs`       | `number \| "indefinite"` | `1000`  | How long the shake lasts.                                                                                                         |
| `cycleMs`          | number                   | `100`   | The time for one shake there and back.                                                                                            |
| `easing`           | CSS easing function      | none    | How the strength fades, to nothing by the end. Without one, the full `dx` and `dy` apply throughout. Ignored when `"indefinite"`. |

An item reaching every edge of the display is enlarged just enough while it shakes that no gap shows at the edge.

### Item fall

```json
{
  "on": { "interact": ["jump-from"], "target": "#some-element" },
  "do": [{ "effect": "item-fall", "target": "#some-element", "durationMs": 1000, "easing": "ease-in" }]
}
```

| Property     | Type                     | Default  | Meaning                                                                                                    |
| ------------ | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `durationMs` | `number \| "indefinite"` | `1000`   | Time until the element has left the display. If `"indefinite"`, it falls again from the start, repeatedly. |
| `cycleMs`    | number                   | `1000`   | The length of one fall, when `"indefinite"`.                                                               |
| `easing`     | CSS easing function      | `linear` | How the fall speeds up.                                                                                    |

The element stays off-screen until its display resets. Off-screen, it can't be interacted with, as interactions measure where elements appear.

### Item move

```json
{ "effect": "item-move", "target": "#lift", "start": { "left": 50, "top": 100 }, "end": { "left": 50, "top": 50 } }
```

| Property     | Type                     | Default                  | Meaning                                                                           |
| ------------ | ------------------------ | ------------------------ | --------------------------------------------------------------------------------- |
| `start`      | position                 | where the element is now | Where the move begins.                                                            |
| `end`        | position                 | required                 | Where the move ends. The element stays there until its display resets.            |
| `durationMs` | `number \| "indefinite"` | `1000`                   | How long the move takes. If `"indefinite"`, it jumps back to `start` and repeats. |
| `cycleMs`    | number                   | `1000`                   | The length of one move, when `"indefinite"`.                                      |
| `easing`     | CSS easing function      | `linear`                 | How the move speeds up and slows down.                                            |

A position is one of:

| Form                                             | Meaning                                                     |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `{ "left": 50, "top": 20 }`                      | A place in the display.                                     |
| `{ "by": { "left": 0, "top": -10 } }`            | An amount from where the element is when the effect starts. |
| `{ "from": "#selector", "left": 0, "top": -10 }` | An amount from the centre of another element.               |

### Highlight

This pair of rules pulses an element while a player is near it:

```json
[
  {
    "on": { "interact": ["near-enter"], "target": "#some-element", "within": 10 },
    "do": [
      {
        "effect": "highlight",
        "target": "#some-element",
        "durationMs": "indefinite",
        "sequence": [
          { "filter": "brightness(1.5)", "shadow": "0 0 2cqw gold", "durationMs": 500, "easing": "ease-in" },
          { "filter": "brightness(1)", "shadow": "0 0 0 gold", "durationMs": 500, "easing": "ease-out" }
        ]
      }
    ]
  },
  {
    "on": { "interact": ["near-exit"], "target": "#some-element", "within": 10 },
    "do": [{ "effect": "stop", "target": "#some-element", "stop": "highlight" }]
  }
]
```

| Property     | Type                     | Default                 | Meaning                                                                               |
| ------------ | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| `durationMs` | `number \| "indefinite"` | once through `sequence` | `"indefinite"` repeats the sequence until stopped. A number repeats it for that long. |
| `sequence`   | list of steps            | required                | A series of styles, played in order.                                                  |

Each step of `sequence`:

| Property     | Type                | Default | Meaning                                                                           |
| ------------ | ------------------- | ------- | --------------------------------------------------------------------------------- |
| `filter`     | CSS `filter`        | none    | Applied to the element.                                                           |
| `shadow`     | CSS `box-shadow`    | none    | Applied to the element.                                                           |
| `outline`    | CSS `outline`       | none    | Applied to the element.                                                           |
| `durationMs` | number              | `1000`  | How long the step takes.                                                          |
| `easing`     | CSS easing function | none    | How the step's styles build. Without one, they apply at full strength throughout. |

When the sequence ends, the element returns to its own styles. There is no `border`, as that can change an element's size, which moves its layout and where the camera thinks it is: use `outline`.

## Stopping an effect

```json
{ "effect": "stop", "target": "#some-element", "stop": "highlight" }
```

| Property  | Type                    | Default     | Meaning                                              |
| --------- | ----------------------- | ----------- | ---------------------------------------------------- |
| `target`  | CSS selector            | every item  | The elements to stop effects on.                     |
| `players` | `"triggering"`, `"all"` | none        | The players to stop effects on, instead of `target`. |
| `stop`    | an effect's name        | all effects | Which effect to stop.                                |

An item returns to where its template puts it, even from a finished `item-fall` or `item-move`. `player-static` fades away over its `easeMs`.

`player-fall` and `player-spin-away` must finish, so `stop` can't end them. The one-way effects (`player-invisible`, `player-visible`, `player-freeze`, `player-unfreeze`, `player-restore`) have nothing running to stop, and have their own opposites. Naming any of these is an error on load.

## Effect end trigger

Fires when an effect finishes, so a game can follow one thing with another without matching times by hand.

```json
[
  {
    "on": { "interact": ["jump-onto"], "target": "#bridge" },
    "do": [{ "effect": "item-fall", "target": "#bridge" }]
  },
  {
    "on": { "effectEnd": "item-fall", "target": "#bridge" },
    "do": [{ "set": { "bridgeGone": "true" } }]
  }
]
```

| Property    | Type             | Default     | Meaning                                          |
| ----------- | ---------------- | ----------- | ------------------------------------------------ |
| `effectEnd` | an effect's name | required    | The effect to watch for.                         |
| `target`    | CSS selector     | any element | Only fire for these elements. Item effects only. |

- **How often:** once per element or player, as `animationEnd` does. `event.id` is the element's id, and `event.player` the player's number.
- **Where:** it fires rules in the display whose rule started the effect.
- **When it doesn't fire:** if the effect was ended early by `stop`, or by its display closing or resetting. An `"indefinite"` effect has no end.
- **Reduced motion:** it still fires, as the effect has jumped to its end.
- **Player effects:** `game.players.removed` has already changed by the time `player-fall` and `player-spin-away` fire this. `player-freeze` and `player-unfreeze` fire it at once.

## Player effects

These use `players` rather than `target`, as a rule usually means "whoever did this": see [choosing players](player-tracking.md#choosing-players). They need the camera, and `visionSmoothing` on. With a camera refused or failed in play, they do nothing and the game plays on. On a display where the camera can never be on, they are an error on load:

```text
stages[0] (lava) › challenges[0] (floor) › displays[0] (challenge-in-progress) › rules[2].do[0]:
player-fall needs a player, but this display doesn't have the camera enabled
```

### Falling

```json
{
  "on": { "interact": ["foot-enter"], "target": ".pit", "threshold": 0.3 },
  "do": [{ "effect": "player-fall", "durationMs": 1000, "easing": "ease-in" }]
}
```

| Property     | Type                    | Default        | Meaning                                                     |
| ------------ | ----------------------- | -------------- | ----------------------------------------------------------- |
| `players`    | `"triggering"`, `"all"` | `"triggering"` | Who falls.                                                  |
| `durationMs` | number                  | `1000`         | Time until they are off-screen. `"indefinite"` is an error. |
| `easing`     | CSS easing function     | `linear`       | How the fall speeds up.                                     |

From the moment they start to fall, their image freezes, they can't interact with anything, and they fire the `-exit` of whatever they were over. Their depth stays as it was. Once off-screen they are removed.

### Spin away

```json
{
  "on": { "interact": ["body-enter"], "target": ".boulder", "threshold": 0.2 },
  "do": [
    {
      "effect": "player-spin-away",
      "durationMs": 1200,
      "angle": { "min": -60, "max": 60 },
      "zoom": 0.3,
      "opacity": 0,
      "rotations": 2
    }
  ]
}
```

| Property     | Type                               | Default                     | Meaning                                                                                                                                |
| ------------ | ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `players`    | `"triggering"`, `"all"`            | `"triggering"`              | Who spins away.                                                                                                                        |
| `durationMs` | number                             | `1000`                      | Time until they are off-screen. `"indefinite"` is an error.                                                                            |
| `angle`      | `{ "min": number, "max": number }` | `{ "min": -60, "max": 60 }` | The directions they may leave in, in degrees on screen. `0` is straight up, `90` is right, and `-90` is left. One is picked at random. |
| `zoom`       | number                             | `1`                         | How much bigger or smaller they are by the time they are off-screen, as a multiple above 0.                                            |
| `opacity`    | number, 0–1                        | `1`                         | How opaque they are by the time they are off-screen.                                                                                   |
| `rotations`  | number                             | `2`                         | How many times they turn on the way. The direction of spin is random.                                                                  |
| `easing`     | CSS easing function                | `ease-out`                  | How the movement slows.                                                                                                                |

Depth, interactions, `-exit`s, freezing and removal work as for falling. They turn about the centre of their body, not of their canvas, and the distance allows for `zoom`, so a large player has fully left before they are removed.

### Invisible and visible

```json
{ "effect": "player-invisible", "players": "triggering", "durationMs": 500 }
```

| Property     | Type                    | Default        | Meaning                                              |
| ------------ | ----------------------- | -------------- | ---------------------------------------------------- |
| `players`    | `"triggering"`, `"all"` | `"triggering"` | Who changes.                                         |
| `durationMs` | number                  | `0`            | How long the fade takes. `"indefinite"` is an error. |
| `easing`     | CSS easing function     | `linear`       | How the fade progresses.                             |

An invisible player is still active, and can still interact.

### Freeze and unfreeze

This freezes whoever touches the ice for 3 seconds:

```json
{
  "on": { "interact": ["body-enter"], "target": ".ice", "threshold": 0.2 },
  "do": [{ "effect": "player-freeze" }, { "effect": "player-unfreeze", "delayMs": 3000 }]
}
```

A frozen player can't fire rules, so `player-unfreeze` needs `"players": "all"`, or a delay from the rule that froze them, as above.

Both apply at once. The player's silhouette and picture stop updating, and they fire the `-exit` of whatever they were over. They are still active, and count in `game.players.frozen`. Once unfrozen, they return to the live camera, so may appear to jump, and must leave and come back to anything they are already over. A frozen player can still fall or spin away, but `player-unfreeze` does nothing to one leaving or removed.

### Static

Makes the player seem partly transparent, like a detuned TV.

```json
{ "effect": "player-static", "durationMs": "indefinite", "pixelSize": 0.5, "proportion": 0.6, "easeMs": 500 }
```

| Property     | Type                     | Default        | Meaning                                                                                                    |
| ------------ | ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `players`    | `"triggering"`, `"all"`  | `"triggering"` | Who it applies to.                                                                                         |
| `durationMs` | `number \| "indefinite"` | `"indefinite"` | How long it lasts, including easing in and out. If `"indefinite"`, it holds until stopped, then eases out. |
| `pixelSize`  | number                   | `0.5`          | The size of each block of static, as a % of the display's width.                                           |
| `proportion` | number, 0–1              | `0.5`          | The target proportion of the player's pixels made transparent.                                             |
| `easeMs`     | number                   | `500`          | How long it takes to reach `proportion`, and to fade away again.                                           |
| `easing`     | CSS easing function      | `linear`       | How the proportion changes while easing.                                                                   |

The player is still active and can still interact, as this only changes how they are drawn. It goes over a frozen image too.

### Restore

```json
{ "effect": "player-restore", "players": "all", "durationMs": 500 }
```

| Property     | Type                    | Default        | Meaning                                                                                                   |
| ------------ | ----------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `players`    | `"triggering"`, `"all"` | `"triggering"` | Who to restore. Removed players can't fire rules, so this is usually `"all"`, which includes the removed. |
| `durationMs` | number                  | `500`          | How long they take to fade back in. `"indefinite"` is an error.                                           |

See [how players are restored](player-tracking.md#restoring) for when this happens by itself.

## Rewards

A `reward` action shows a [partycles](https://www.npmjs.com/package/partycles) celebration. It isn't shown to players who prefer reduced motion.

```json
{ "reward": { "animation": "stars", "particleCount": 40 }, "target": "#prize" }
```

| Property  | Type                            | Default           | Meaning                                                                    |
| --------- | ------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| `reward`  | `{ animation, particleCount? }` | required          | The celebration, as for a game's [`reward`](game-data.md#reward).          |
| `target`  | CSS selector                    | the game's middle | Each burst starts from the centre of a matching element.                   |
| `players` | `"triggering"`, `"all"`         | none              | Each burst starts from the centre of a player's body, instead of `target`. |
| `delayMs` | number                          | `0`               | How long to wait first.                                                    |

A burst on `.player-N` starts from the centre of the player's body too, as the centre of their canvas would be the middle of the display. If the element has gone by the time a delayed reward plays, it starts from the middle of the game.

A game's `reward` is separate, and plays as a stage completes.

## Template CSS animations

A template can animate its own elements with CSS, in the game's [stylesheets](game-data.md#stylesheets). These restart when their display resets, and end when it closes. Use the [`animationEnd` and `transitionEnd` triggers](game-data.md#rules) to follow them, as those don't fire for effects, which use the Web Animations API.
