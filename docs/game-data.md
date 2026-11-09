# Game data

A game is one `GameData` object (`src/entities/data/GameData.ts`), authored as JSON inside a [game repository](game-repository-data.md). Its JSON schema, generated from the types, is `public/schemas/game-data-schema.json`. Check a game with `./validate-game.sh path/to/game.json`, which validates its schema, and that its resource files, templates and resource names can load. Mistakes in a game's [rules](#rules-and-state) are reported when it loads, and `npm test` checks the rules of every game in the local repository.

## Structure

```text
GameData
├── title, description                 shown as-is; the description goes on the landing-page tile
├── tileGraphic?                       resource name of the tile's background image (see Landing tile)
├── gameContainerStyle                 applied to the game's outer container
├── config?                            { sequential, autoAdvanceStages }
├── modules?                           { scene?, avatar? }: how scenes are laid out, and what stands in for the player
├── resources?                         name → { type, target }        (see Resources)
├── sounds?                            resource names of music and sound effects (see Sounds)
├── reward?                            { animation, particleCount? }: celebration on stage completion
├── credits?                           [{ text, url? }]: credits for third-party media (see Credits)
├── stylesheets?                       resource names of CSS files to load (see Stylesheets)
├── scenes: GameOverviewScene[]    the screens shown when no stage is open
└── stages: GameStageData[]
    ├── id
    ├── scenes?: GameStageScene[]  a "shared" scene behind the stage's challenges
    ├── challengeChunking?             how many challenges show at once (default 1)
    └── challenges: GameChallengeData[]
        ├── id
        ├── scenes: GameChallengeScene[]
        └── solution: GameChallengeSolution
            └── answers, ignoreCase, trimWhitespace, ignoreWhitespace
```

- **`config.sequential`** (default `true`) unlocks only the first stage at the start. Each completed challenge then unlocks the first stage that isn't complete. With `false`, every stage starts unlocked.
- **`config.autoAdvanceStages`** decides what happens when a stage is complete. With `true`, the game goes straight to the next incomplete stage. Otherwise it returns to the `game-overview-stages` scene if it has one, and goes straight on if it doesn't.
- **`solution`**: an answer matches if it equals any of the `answers` after the optional case and whitespace normalisation. All three normalisations default to `true`.

## Scenes

Scenes were once called displays. Game data that still uses `displays` or `resetDisplay` fails validation and loading, naming the new key.

Every scene has a `purpose`, which says when it shows, and a `component`, which says how it renders (`src/entities/data/scenes/`).

| Level     | Purposes                                                                | Chosen by                                                                                               |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Game      | `game-overview-title`, `game-overview-stages`, `game-overview-complete` | `gameState.current.overviewScene`. The game starts on the title if it has one, otherwise on the stages. |
| Stage     | `shared`                                                                | Shown whenever that stage is open                                                                       |
| Challenge | `challenge-title`, `challenge-in-progress`, `challenge-completed`       | Unsolved: the first it has of title, in-progress, completed. Solved: of completed, in-progress, title.  |

The selection code is `calcOverviewScene`, `calcStageScene` and `calcChallengeScene` in `src/components/core/logic/RenderDataUtils.ts`. Once every stage is complete, the overview switches to `game-overview-complete`, or falls back to the title, and then to the stages.

Any scene's component can have **state** and **rules**, which respond to clicks, the camera, animations,
timers and changes in the game: see [Rules and state](#rules-and-state). A click on the title screen that no rule
takes moves on to the stages overview. Clicks remain the keyboard-accessible route; for keyboard access, see
[clickable elements in templates](dev-overview.md#clickable-elements-in-templates).

### Scene and avatar modes

`modules` sets two things for the whole game, and any scene (or reset scene) can override either with its own
`scene` or `avatar`:

```json
"modules": {
  "scene": "2D",
  "avatar": { "mode": "camera", "fallback": "mouse", "preview": true }
}
```

**`scene`** is how a scene is laid out:

| `scene` | Layout                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2D`    | A full-screen background, the players, and a foreground. The default.                                                                                                                                                  |
| `2.5D`  | As `2D`, fitted to the floor the player [calibrated](camera-mode.md#calibrating-the-floor): the camera is cropped to the floor, and the view takes the crop's shape, so players' feet stay in view all over the floor. |

A game with any `2.5D` scene asks a player using the camera to calibrate the floor before starting. In a `2.5D` scene,
items can be [placed on the floor](#floor-placed-items), and players pass in front of and behind them. The scene mode
resolves most specific first: `2.5D` if any active challenge sets it, else `2D` if one does, then the open stage's
`shared` scene, the overview scene, the game's `modules`, and finally `2D`. A reset scene's setting is over its
parent's. Nanny's Magic Trifle and the demo are `2.5D` games.

#### Floor-placed items

Every room's calibration differs, so items can't be hand-placed on the floor. Instead, give an item in a template
floor coordinates, and the engine places it and scales it for its distance. Floor coordinates run 0–100 across the
floor at the item's depth, and 0–100 from back to front, so every floor point can be reached in any room.

| Attribute              | Meaning                                                                                                                              | Default                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `data-floor-y`         | How far forward the item stands: 0 at the back edge, 100 at the front. Its presence makes the item floor-placed.                     | required                                                      |
| `data-floor-x`         | Where across the floor it stands: 0 at the left edge on screen, 100 at the right, at that depth.                                     | where the layout puts it across the viewport, read as floor x |
| `data-floor-height`    | How high above the floor its anchor sits, in the same units as x, so it shrinks with distance.                                       | `0`                                                           |
| `data-floor-anchor`    | The point on the item that sits at those coordinates, in CSS `transform-origin` syntax: `center bottom`, `left center`, `40% 70%`, … | `center bottom`, the point that touches the floor             |
| `data-floor-thickness` | The band of floor y, centred on the item, that a player must stand in for their camera interactions with it to count.                | none: interactions count from anywhere                        |

```html
<div id="tree" data-floor-x="20" data-floor-y="40" style="position: absolute; width: 15cqw; height: 40cqh">…</div>
```

- **Size an item as it would appear at the front edge.** The engine scales it by the floor's width at its depth,
  relative to the front edge's, and moves its anchor onto its floor point. It uses the CSS `translate` and `scale`
  properties, not `transform`, so the layout is untouched, and animations and effects that use `transform` still
  work. The anchor becomes the item's `transform-origin`, so such an animation pivots on it. Effects that `replace`
  rather than add to an item's motion override its placement while they run.
- **Layering.** Floor items in a challenge's foreground sort among the players by depth. Elsewhere, they are placed and
  scaled, but stay behind the players (overview and stage foregrounds) or in front of them (anything in a challenge's
  foreground that isn't floor-placed, like a dialog or a HUD).
- **Not inside a transformed wrapper.** An item is placed from where the layout puts it, which ignores transforms, so a
  wrapper with its own `transform` throws it off.
- **The back corners.** The floor narrows towards the back, so the back corners of a scene may be out of reach. Put
  anything a player must stand on onto the floor. In debug mode, what is off the floor is shaded.
- **Thickness only counts for the camera's players.** The mouse, even as feet, points at an item rather than
  standing by it.
- **In a 2D scene** the attributes do nothing, and validation warns of them. `data-depth`, which came before them,
  fails validation, naming `data-floor-y`.
- A scene's background image set to `cover` still fills the reshaped viewport, though it doesn't line up with the floor.

The demo's "Walk around" stage shows floor items, thickness, and an item following a player's position.

#### Floor surfaces

A 2.5D scene can also draw surfaces in the floor's perspective: a floor made of tiles, walls around it, and
backgrounds behind them. The engine works out where each surface's four corners are on screen and draws the element's
box onto them with a CSS `matrix3d`, so whatever the element holds (colour, images, text) is drawn in perspective.

| Attribute or class                                       | Surface                                                                                                                                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-floor-area="left back right front"`                | That rectangle of the floor, laid flat. Use several to make a floor of tiles.                                                                                                                       |
| `floor-background`                                       | The whole floor, laid flat, behind any floor areas.                                                                                                                                                 |
| `rear-wall`, `left-wall`, `right-wall`, `front-wall`     | Upright along the whole of that edge of the floor. `data-floor-height` sets its height, in floor x units like a floor item's; it defaults to `100`, as high as the floor is wide.                   |
| `rear-background`, `left-background`, `right-background` | A backdrop behind the wall on that side: upright, standing on the ground some way beyond the floor's edge, and stretched to reach the top and sides of the viewport. It fills any gaps in the wall. |
| `ground-background`                                      | The ground: the floor's plane carried on beyond its edges, to the sides and bottom of the viewport and back to the horizon. For a picture that spans the whole screen, not just the floor.          |
| `horizon-background`                                     | The furthest backdrop: upright, with its bottom edge on the horizon, filling up to the top of the viewport.                                                                                         |

```html
<div class="horizon-background" style="background: linear-gradient(#457b9d, #a8dadc)"></div>
<div class="rear-background" style="background: url('{{resources.forest}}') bottom / 50% 60% repeat-x"></div>
<div class="floor-background" style="background: url('{{resources.river}}') center / 100% 100%"></div>
<div class="rear-wall" data-floor-height="10" style="background: url('{{resources.bank}}') center / 100% 100%"></div>
<div id="stepping-stone" data-floor-area="40 40 60 60" style="background: grey; border-radius: 45%"></div>
```

- **All optional.** Use whichever surfaces the scene needs. Outdoors, leave out the rear background and let the
  horizon show. Indoors, a full-height rear wall or background hides the horizon, as a real room's would.
- **The box.** A surface fills its container by default, from the container's top left. Its box is stretched onto the
  surface, so its size only sets how its content is stretched: set `background-size` in percentages, and expect a
  picture to be squashed or stretched to the surface's shape on screen.
- **Distance.** `data-wall-distance` sets how far beyond the floor's edge an upright surface stands, in floor units: y
  units for the rear and front, x units for the sides. Walls default to `0`, on the edge. Backgrounds default to `50`.
  Backgrounds stand on the ground at a distance, so they shrink and move with the calibration, as walls do.
- **Painting order**, back to front: `horizon-background`, `ground-background`, the rear, left and right backgrounds,
  `floor-background`, floor areas, then walls. Transparent parts of a surface show what's behind it, which for a
  background is the ground running on to the horizon.
- **Surfaces paint beneath the rest of their template.** A positioned wrapper around them is above them, and takes the
  pointer first, so give it `pointer-events: none` if anything should react to the surfaces. Each template outside a
  challenge's foreground is its own stacking context, so surfaces still paint above the scene's `backgroundStyle`.
- **Walls among players.** In a challenge's foreground, the rear and side walls stand behind every player and the front
  wall in front of them all. A front wall stands between the players and the camera and hides their legs, so it only
  really works as a low fence. Floor areas and backgrounds there are behind the players too, and a background in the
  foreground hides the challenge's background layer.
- **Upright means upright on screen.** That assumes the camera isn't rolled; a rolled camera makes walls lean slightly.
- **The horizon** is where the floor's side edges meet, and where its front and back edges meet: with the default
  corners it is level, about 4% below the viewport's top. It slants if the calibration isn't symmetrical, and
  `horizon-background` slants with it. A steeper camera, or a back edge dragged lower, can push it above the viewport,
  and then `horizon-background` isn't drawn.
- **Standing on a floor area.** Feet interactions with a floor area (camera players and mouse-feet) count only where
  the area is drawn, as its box on screen is wider than the area. A floor area is hit-tested where it is drawn, so
  mouse moves and clicks on it are too.
- **Effects** that move or drop an item use the CSS `translate` property, which applies on top of a surface's
  `matrix3d`, so a floor area falls down the screen as other items do.
- **In a 2D scene** these attributes and classes do nothing, and validation warns of them.

Nanny's Magic Trifle's stepping stones stand on a river with its far bank, a forest and the sky. The demo's "Walk
around" stage has a tiled floor (one tile lights underfoot), low walls, hills and a horizon. Its lava and stone hop
stages lay their pools and stones on the floor.

**`avatar`** is what stands in for the player:

| `mode`       | The player plays with                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mouse`      | Clicks and mouse moves. The default.                                                                                                   |
| `camera`     | Their [camera](camera-mode.md) silhouette, and clicks.                                                                                 |
| `mouse-feet` | Clicks and mouse moves, and the pointer is player 1's feet: see [mouse-feet](camera-mode.md#mouse-feet). Scenes play without a camera. |

- `fallback` is the mode to use when the camera isn't available: `mouse` or `mouse-feet`. A `camera` mode with no
  fallback means the camera is required: the game can't start until the camera permission is granted. With a
  fallback, it can start without it.
- `preview` (default `true`) shows the webcam preview. It is always off unless the mode is `camera`.

`mode` and `fallback` go together: a scene that sets `mode` doesn't inherit a broader `fallback`, so
`"avatar": { "mode": "camera" }` requires the camera however the game is set. `preview` inherits on its own, so
`"avatar": { "preview": false }` keeps the broader mode.

The avatar resolves most specific first:

1. Mode: the strongest mode any active challenge sets, `camera` before `mouse-feet` before `mouse`. Preview: any
   active challenge that turns it on, otherwise any that turns it off.
2. Otherwise, the open stage's `shared` scene.
3. Otherwise, the overview scene.
4. Otherwise, the game's `modules`.
5. Otherwise, the default: the mouse, preview on.

`modules.avatar` replaced `modules.camera`. Game data that still uses `camera` fails validation and loading, naming
`avatar` and the rewrite: `requirement: "required"` is `mode: "camera"` with no fallback, `"enabled"` is
`mode: "camera", fallback: "mouse"`, and `false` is `mode: "mouse"`. See [camera mode](camera-mode.md) for what the
player sees and how the settings behave in practice.

### Rules and state

Every component can keep its own **state**, and change it, or act on the game, with **rules**. Rules are data:
templates only render the state, and no game script ever runs. The `rules-demo` game in
`public/game-repository.json` (templates in `public/games/rules-demo/`) is a working example of everything here.

```json
"component": {
  "type": "template",
  "data": {},
  "initialState": { "position": 1 },
  "rules": [
    {
      "on": { "interact": ["click", "hand-enter"], "target": "#switch" },
      "do": [{ "set": { "position": "if state.position == 1 then 2 else 1" } }]
    }
  ]
}
```

```handlebars
<div id="switch" class="switch position-{{state.position}}"></div>
```

#### State

- A scene starts from its `initialState` (or `{}`), and templates, styles and rules see it as `state`.
- State is kept for the life of the game, and saved with its progress, so it survives the scene being hidden
  and shown again, and a reload.
- With `resetStateOnShow: true`, it returns to `initialState` each time the scene is shown.
- Resetting a challenge (the `resetChallenge` action) resets the state of that challenge's scenes. A New game
  from the landing page clears everything.
- A reset also rebuilds the scene's templates, restarts its timers and fires its `start` rules again: see
  [ending with the scene](special-effects.md#ending-with-the-scene).
- Each scene has its own state. Scenes can't share state yet.

#### Reset scenes

A scene can have a `resetScene`, shown in its place until one of the reset scene's rules runs
`{ "finishReset": true }`. Use it to get players ready, eg. "return to the start" before a lava floor appears, or
a countdown before balloons fall. Until then, the scene's own rules, timers and `start` wait.

```json
"resetScene": {
  "showOn": "every-show",
  "component": {
    "type": "template",
    "initialState": { "count": 3 },
    "rules": [
      { "on": { "every": 1000 }, "do": [{ "set": { "count": "state.count - 1" } }] },
      { "on": { "after": 3000 }, "do": [{ "finishReset": true }] }
    ],
    "foregroundTemplate": { "sourceType": "relative", "templateSource": "games/rules-demo/balloons-ready.hbs" }
  }
}
```

- `showOn` is `first-show` (the default: once, until the reset scene is finished) or `every-show` (each time
  the scene is shown).
- `resetChallenge` shows the challenge's reset scenes again, and so does reloading the game: whether a reset
  scene is finished is never saved.
- A reset scene's state starts from its `initialState` each time it is shown.
- It inherits the scene's `scene` and `avatar` settings, and may override them with its own.
- A reset scene can have a reset scene of its own, shown first.
- Revealing the scene fades, like any scene change. Camera interactions pause during the fade, so a player
  already standing on something doesn't trigger it on the revealed scene.

#### Rules

A rule has a trigger (`on`), an optional condition (`if`, an expression), and actions (`do`), applied in order.
Rules on scenes that aren't showing do nothing. An overview scene counts as showing only while no stage is
open.

| Trigger                                                      | Fires                                                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ "interact": …, "target": "<selector>", "holdMs"?: <ms> }` | When any player (or the mouse) interacts with an element matching the selector; with `holdMs`, once they have stayed that long. `jump` alone may leave out `target`, to fire on every landing |
| `{ "effectEnd": "<effect>", "target"?: "<selector>" }`       | When an [effect](special-effects.md#effect-end-trigger) finishes                                                                                                                              |
| `{ "animationEnd": "<name>", "target": "<selector>" }`       | When a CSS animation with that name ends on a matching element                                                                                                                                |
| `{ "transitionEnd": "<property>", "target": "<selector>" }`  | When a CSS transition of that property ends on a matching element                                                                                                                             |
| `{ "when": "<expression>", "forMs"?: <ms> }`                 | When the expression turns from false to true, after any change; with `forMs`, once it has stayed true that long                                                                               |
| `{ "every": <ms or expression> }`                            | Repeatedly while the scene shows; an expression is worked out again each time                                                                                                                 |
| `{ "after": <ms or expression> }`                            | Once, that long after the scene is shown                                                                                                                                                      |
| `{ "start": true }`                                          | When the scene is shown                                                                                                                                                                       |

| Action                                                                   | Does                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ "set": { "key": "<expr>" }`                                           | Sets state keys to expressions' values, all worked out from the state before the action                                                                                                  |
| `{ "resetState": true }`                                                 | Returns the scene's state to `initialState`                                                                                                                                              |
| `{ "completeChallenge": true }`                                          | Solves this scene's challenge, as a correct answer does (challenge scenes only)                                                                                                          |
| `{ "answer": "<expression>" }`                                           | Submits the expression's value as an answer to this scene's challenge (challenge scenes only)                                                                                            |
| `{ "resetChallenge": true }`                                             | Makes this scene's challenge unsolved again, and resets its scenes' state (challenge scenes only)                                                                                        |
| `{ "enterStage": "<stage id>" }`                                         | Opens a stage, unless it is locked or completed                                                                                                                                          |
| `{ "finishReset": true }`                                                | Reveals the scene this reset scene stands in for (reset scenes only)                                                                                                                     |
| `{ "sound": "<resource>" }`                                              | Plays a sound resource                                                                                                                                                                   |
| `{ "reward": { "animation", "particleCount"? }, "target"?, "players"? }` | Shows a [partycles](https://www.npmjs.com/package/partycles) celebration, like the stage [reward](#reward), from the middle of the game or [what it targets](special-effects.md#rewards) |
| `{ "effect": "<effect>", … }`                                            | Runs a [special effect](special-effects.md) on elements or players                                                                                                                       |

Every action can have a [`delayMs`](special-effects.md#delay).

- Selectors are any CSS selector (`#door`, `.lava`, `.door:not(.open)`), matched inside the scene's own
  templates. A click fires the rules whose selector matches the clicked element or its nearest matching ancestor.
- `when` doesn't fire for an expression that is already true when the scene is shown: it records it, and fires
  the next time it turns true. Use `start` with an `if` for "when shown, if…".
- A `set` can make a `when` fire, which can `set` again. A chain of more than 10 rounds is logged, naming the
  rules, and stopped.
- `every` waits at least 50 ms between firings.
- `sound` and `reward` don't hold anything up: the rule's other actions apply at once, and sounds and rewards from
  the same rule start together (or after their own `delayMs`), carrying on even if their scene closes or resets. Each plays once. Sounds play at full volume. With reduced
  motion, rewards aren't shown but sounds still play. A reload drops effects still waiting to play.
- `holdMs` and `forMs` restart from zero if the player moves away, or the expression turns false, before the time
  is up. `holdMs` works only with `-enter` interactions.
- Everything is checked when the game loads: an expression that doesn't parse, an invalid selector, a negative
  duration, a challenge action outside a challenge scene, `enterStage` to a stage the game doesn't have, a `start`
  rule that resets its own scene, a mistake in an [effect](special-effects.md), or a rule that no avatar mode the
  scene can have would fire, stops the game loading, with a message naming the scene and rule. A selector that matches nothing in the scene is
  a console warning. So does a `holdMs` on an interaction that isn't an `-enter`, `finishReset` outside a reset
  scene, a `sound` naming a resource the game doesn't have, or an old name: an interaction (eg. `hand`, now
  `hand-enter`), or a layer class (`.display-foreground`, now `.scene-foreground`).

#### Expressions

Conditions, `set` values, answers and durations are short [filtrex](filtrex.md) expressions, eg.
`state.score + 1`, `state.score >= data.target`, `if state.position == 1 then 2 else 1`, `not state.popping`.
They see:

| Name    | What it is                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `state` | This scene's state                                                                                                                    |
| `data`  | The component's `data`, as authored                                                                                                   |
| `game`  | The game's progress: `id`, `title`, `config`, `stages` (each with `id`, `availability`, `completion` and `challenges`), and `current` |
| `event` | For element triggers: the matched element's `id` (empty if it has none) and the `interaction`                                         |

See [how filtrex works](filtrex.md) for the syntax and why it is safe.

#### Interactions

| Interaction                                                    | The player does                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `click`                                                        | Clicks the element, or focuses it and presses Enter/Space                     |
| `mouse-enter`                                                  | Moves the mouse onto the element, from outside it                             |
| `mouse-exit`                                                   | Moves the mouse off the element                                               |
| `hand-enter`                                                   | Puts either hand over the element                                             |
| `foot-enter`                                                   | Puts either foot over the element                                             |
| `head-enter`                                                   | Puts either side of their face over the element                               |
| `body-enter`                                                   | Covers the element with their whole silhouette                                |
| `any-enter`                                                    | Covers it with any single body part                                           |
| `hand-exit`, `foot-exit`, `head-exit`, `body-exit`, `any-exit` | Stops doing the matching `-enter`, or leaves the camera's view while doing it |
| `jump`                                                         | Jumps up from the element and lands back on it                                |
| `jump-from`                                                    | Jumps from the element, landing anywhere                                      |
| `jump-onto`                                                    | Jumps onto the element, from anywhere                                         |
| `near-enter`                                                   | Comes within `within` of the element                                          |
| `near-exit`                                                    | Leaves that range, or the camera's view while in it                           |

`interact` takes one interaction or a list. Moving the mouse between an element's own parts neither enters nor leaves
it. `mouse-enter` is a good mouse stand-in for walking onto something with the camera (the lava demo uses it with
`foot-enter`); pair it with `click` where keyboard players need a way in too. `threshold` is the fraction of the body part that must be inside the
element (0–1, default `1`). Interactions fire once per approach, and re-arm when the player moves away. An `-exit`
fires only after its `-enter` has fired, so pair them (eg. `["hand-exit", "mouse-exit"]` to undo
`["hand-enter", "mouse-enter"]`, as the demo's bulb does). The monitor
is described under [how interactions work](camera-mode.md#how-interactions-work), and jumps under
[jumps](camera-mode.md#jumps). Jump interactions fire as the player lands.

`near-enter` and `near-exit` need `within`: how close counts as near, from the centre of the element to the closest
part of the player's silhouette, as a % of the scene's width. So it is a circle on screen whatever the scene's
shape, and it works from behind, where key points may not be found. It follows `visionStableFrames`, and a player
already in range when a scene appears must leave and come back. `holdMs` works with `near-enter`, and `threshold` and
`includeCovered` don't apply. There's no mouse equivalent, though a rule can use `mouse-enter` as well.

A rule whose interactions no avatar mode the scene can have would fire is an error: a `hand-enter` rule on a scene
that is only ever `mouse` or `mouse-feet`, say. A `camera` mode with a fallback counts as both, so its scene can have
camera rules for when there is a camera. In `mouse-feet` the pointer fires `foot-enter`, `foot-exit`, `any-enter`,
`any-exit` and the jumps, as player 1. Effects that act on players need a scene that can be in `camera` mode.

#### What can be clicked or touched

Only elements a template draws take clicks: empty space in a layer lets them through to whatever is beneath,
including background layers. An element drawn over another covers it, so the one beneath gets neither the click
nor the camera's touch, unless its rule sets `"includeCovered": true` (camera and mouse-feet interactions only). Give decorative
elements `pointer-events: none` so they don't cover what's beneath them.

#### Elements that animate or keep state

Templates are patched in place when state changes, rather than replaced, so CSS transitions and animations carry
on, until the scene [resets](special-effects.md#ending-with-the-scene). An element is matched to its previous self by `id`, so give an `id` to anything that animates or that the
camera tracks. Changing an element's `id` (eg. `balloon-{{state.balloonIndex}}`) makes a new element, which restarts its
animations: a simple way to spawn a replacement.

### Layers

The screen is a stack of layers, and each scene renders into two of them: background and foreground. From back to front:

1. overview
2. the open stage's `shared` scene
3. the active challenges' backgrounds
4. the camera silhouette
5. the challenges' foregrounds
6. the HUD

The active challenges are the first chunk of `challengeChunking` challenges that still has one unsolved. They sit side by side.

### Components

Both component types carry `data`, a free-form object that templates see as `data` (and `componentData`), optional [state and rules](#rules-and-state), and a background and a foreground, each with:

- `backgroundTemplate` / `foregroundTemplate`: a `GameSceneTemplateSourceData` (see [Templating](#templating))
- `backgroundStyle` / `foregroundStyle`: CSS for the layer's container.
- `backgroundTemplateStyle` / `foregroundTemplateStyle`: CSS for the rendered template.

String values in all four styles may use Handlebars over the [template data](#template-data), for example `"backgroundImage": "url('{{resources.bg}}')"`. Numbers pass through as they are. Any other kind of value is an error that names the style key.

The **`template`** type renders those templates and nothing more. The **`dialog`** and **`scroll`** types show paged text on an image. Each entry in their `contents[]` is one page, with:

- `text`
- `showInput` and `label`: an answer box that checks the challenge's solution as the player types
- `media`: a `GameSceneMediaData` audio clip, with optional `stillImageResource` and `motionImageResource` images that play and stop it

Without its own templates, a dialog or scroll shows the page text one paragraph per line. The text scrolls if it doesn't fit, and the page's audio, answer box and page arrows stay in view below it.

A **`dialog`** draws its pages on the game's own image:

- `imageResource`: the resource name of the background image. The image is scaled up or down to the largest size that fits the scene, keeping its shape. The dialog works this out from the image itself, so it needs no size information. Without an image, the dialog fills its scene.
- `imageMargins`: `{ top?, right?, bottom?, left? }`, how far the text sits in from each edge of the image, as CSS percentages of the image's height (`top`, `bottom`) or width (`left`, `right`). Use them to keep text off transparent or decorative edges. Each defaults to no margin.

```json
{
  "type": "dialog",
  "data": {},
  "imageResource": "parchment",
  "imageMargins": { "top": "20%", "right": "12%", "bottom": "10%", "left": "12%" },
  "contents": [{ "text": "Welcome, traveller" }]
}
```

A **`scroll`** is a dialog on the app's own old-paper image, with margins set to suit it, a drop shadow, and text that fades at the top and bottom as it scrolls.

## Resources

`resources` names the files a game uses. Each one is `{ type, target }`. `GameDataProvider` resolves each to an absolute URL when the game loads, and the landing page resolves a game's `tileGraphic` the same way (`resolveResources` in `src/util/ResourceUtils.ts`):

| `type`     | `target` is resolved against                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local`    | This site's base URL (`import.meta.env.BASE_URL`)                                                                                                                                 |
| `relative` | The repository's location: its directory for a remote repository, or the site for a local one. Raw repositories can't use it ([details](game-repository-data.md#relative-paths)). |
| `url`      | Nothing: it must already be an absolute URL                                                                                                                                       |

If a resource can't be resolved, the game's loading state becomes `resource-error`. Media fields such as `media.resource` and `stillImageResource` refer to resources by name. Templates see all of them as `resources`, for example `{{resources.star}}`.

## Landing tile

The landing page shows each game as a square tile with its `title`, its id, its `description`, and `tileGraphic` as the background image behind them. `tileGraphic` is a resource name (see [Resources](#resources)); a game without one, or whose graphic can't be resolved, gets a plain tinted tile instead.

Magic-trifle uses its title background: `"tileGraphic": "title-background"`.

## Sounds

`sounds` names resources (see Resources) for the game's audio. Anything left unset is silent.

| Field                         | Plays                                     |
| ----------------------------- | ----------------------------------------- |
| `openingMusicResource`        | Music, when the stages overview shows     |
| `closingMusicResource`        | Music, on the game-complete overview      |
| `stageOpenedSoundResource`    | A sound effect, when a stage opens        |
| `stageCompletedSoundResource` | A sound effect, when a stage is completed |

For example, magic-trifle sets `"openingMusicResource": "music-opening"`, where `music-opening` is a `local` resource for `games/magic-trifle/music-1.mp3`.

## Reward

`reward` is the celebration shown when a stage is completed: `animation` is the name of a [partycles](https://www.npmjs.com/package/partycles) animation, and `particleCount` (default 200) sets how many particles it launches. Without `reward` there is no celebration. Magic-trifle uses `{ "animation": "fireworks", "particleCount": 200 }`.

## Credits

`credits` lists the third-party media the game uses. The landing page shows each game's credits under that game's heading in the Attributions section: each `text` is a link when `url` is set, and plain text otherwise. The app's own media is credited under the `Footsteps` heading there, in `src/components/landing/Attributions.tsx`. Magic-trifle credits its music, sound effect and bubble text this way.

## Stylesheets

`stylesheets` lists resource names whose files are CSS the game needs, such as a web font. They load when the game is shown, and the game appears once they have loaded (or failed to). Only `https:` or same-site URLs are used; any other is skipped with a console warning. For example, magic-trifle loads its font with `"stylesheets": ["font-dynapuff"]` and sets `"fontFamily"` in `gameContainerStyle`.

## Templating

Templates are [Handlebars](https://handlebarsjs.com/guide/), rendered to HTML. In templates, `{{value}}` is HTML-escaped as usual, so use `{{{value}}}` to insert markup. Values in styles are not escaped, so URLs in CSS stay intact.

Handlebars differs from Mustache in two ways that matter here:

- Inside a block such as `{{#gameState.stages}}`, names resolve against the current item only. To reach the top-level template data, prefix the name with `@root.`, for example `{{@root.resources.star}}`.
- Only Handlebars' built-in helpers (`if`, `unless`, `each`, `with`, `lookup`, `log`) can be used. A template that calls any other helper fails to compile, is logged, and renders nothing.

Game repositories may be remote, so the rendered HTML is sanitised with [DOMPurify](https://github.com/cure53/DOMPurify): scripts, event-handler attributes such as `onclick`, `javascript:` URLs and `<form>` elements are removed.

A `GameSceneTemplateSourceData` gives the template's `sourceType` and its `templateSource` or `content`:

| `sourceType` | Template comes from                                             |
| ------------ | --------------------------------------------------------------- |
| `embedded`   | `content`, inline                                               |
| `local`      | `templateSource`, a path on this site. Local repositories only. |
| `relative`   | `templateSource`, resolved like a `relative` resource           |
| `url`        | `templateSource`, as an absolute URL                            |

`resolveTemplateURL` in `src/providers/GameContentCacheHook.tsx` resolves fetched templates, which are cached for the life of the game.

### Template data

Every template, and every Handlebars value in a style, is rendered with `GameTemplateData` (`src/components/core/logic/RenderDataUtils.ts`):

| Field            | What it holds                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameState`      | The whole `GameState` (`gameData`, `stages`, and `current.stageId` / `current.overviewScene`), decorated by `decorateGameState` for templates. See below. |
| `componentData`  | This scene's `component.data`, as authored                                                                                                                |
| `data`           | The same `component.data`, by the name rules' expressions use                                                                                             |
| `state`          | This scene's [state](#state)                                                                                                                              |
| `game`           | The game's progress, as rules' [expressions](#expressions) see it                                                                                         |
| `resources`      | Resource name → resolved URL                                                                                                                              |
| `challenge`      | The challenge's `GameChallengeData`. Challenge scenes only, otherwise undefined.                                                                          |
| `challengeState` | Its `GameChallengeState` (`succeeded`, …). Challenge scenes only.                                                                                         |

`decorateGameState` (`src/components/core/logic/TemplateUtils.ts`) adds `gameState.totalStages`, and to each entry of `gameState.stages`, alongside `stage`, `availability` and `completion`:

- `index` and `oneIndex`: the stage's position, counting from 0 or 1
- `showCompleted`: the stage is complete
- `showUnlocked`: the stage is unlocked and not complete
- `showLocked`: the stage is locked

A dialog's or scroll's templates also get `text`, the current page's text, and `lines`, its non-blank lines.

### Example

The magic-trifle stages overview (`public/games/magic-trifle/overview/foreground.hbs`) draws a stepping stone per stage. A rule enters each stage when its stone is clicked:

```json
{
  "purpose": "game-overview-stages",
  "component": {
    "type": "template",
    "foregroundTemplate": {
      "sourceType": "relative",
      "templateSource": "games/magic-trifle/overview/foreground.hbs"
    },
    "backgroundStyle": { "backgroundImage": "url('{{resources.blank-river}}')" },
    "data": {},
    "rules": [{ "on": { "interact": "click", "target": "#stages-link-stage-1" }, "do": [{ "enterStage": "stage-1" }] }]
  }
}
```

```handlebars
{{#gameState.stages}}
  {{#showUnlocked}}
    <img
      id="stages-link-{{stage.id}}"
      src="{{@root.resources.stepping-stone}}"
      role="button"
      tabindex="0"
      alt="Stage {{oneIndex}}: play"
      style="width: calc( 75vw / {{@root.gameState.totalStages}} )"
    />
  {{/showUnlocked}}
{{/gameState.stages}}
```
