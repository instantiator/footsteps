# A 2D scene

This tutorial builds a runner played with the camera: snowballs roll along the ground and bats swoop at head height,
and the player jumps and ducks to keep clear of them until the score is reached. It covers the camera avatar and its
mouse fallback, how players are drawn between a scene's background and foreground, body-part interactions, timers,
effects that move things, and a countdown before each run. It follows the **Jump and duck (2D)** game's "Warm-up"
stage; every snippet is quoted from `public/game-repository.json` and `public/games/jump-and-duck/`.

Start from [your first game](your-first-game.md) and [a scene without a camera](scene-without-camera.md), which
cover the game's structure, rules and state. [Camera mode](../camera-mode.md) explains what the camera does.

## Step 1: the camera, with the mouse as a fallback

```json [public/game-repository.json]
"modules": {
  "scene": "2D",
  "avatar": {
    "mode": "camera",
    "fallback": "mouse",
    "preview": false
  }
},
```

- `"mode": "camera"` plays with the player's silhouette, cut out of the webcam picture and drawn into the game.
- `"fallback": "mouse"` lets the game start without a camera, played with the mouse instead. Its landing page says
  "Camera optional", and offers "Play without the camera", which opens the game with `?noCamera=true`. Leave out the
  fallback to require the camera ([scene and avatar modes](../game-data.md#scene-and-avatar-modes)).
- `"preview": false` hides the small webcam preview in the corner; the runner shows the player full size anyway.

Write rules for both: each trigger below names a camera interaction and a mouse one.

**Look for:** the landing page asks for the camera. Grant it, or tick "Play without the camera".

## Step 2: the layers

Each scene draws a background and a foreground. The camera's players are drawn between them: behind a challenge's
foreground, in front of everything else ([layers](../game-data.md#layers)). The run is a foreground template whose
screen is see-through, so the player shows behind the obstacles.

```css [public/games/jump-and-duck/jump-and-duck.css]
/* The run: see-through, so the player's camera image shows behind the obstacles */
.jd-run {
  background: linear-gradient(#14213d33, #3a506b33);
}

.jd-ground {
  position: absolute;
  inset: 92% 0 0;
  background: #f1faee;
  pointer-events: none;
}
```

The template has the ground, a status line, a message for the end of the run, and four obstacles:

<!-- prettier-ignore -->
```html [public/games/jump-and-duck/run.html]
<div class="jd-screen jd-run">
  <div class="jd-ground"></div>
  <p id="jd-status" class="jd-status">Score {{state.score}} of {{data.target}} · Lives {{state.lives}}</p>
  {{#if state.over}}<p id="jd-message" class="jd-message">{{#if state.won}}You made it!{{else}}Ouch! Back to the start…{{/if}}</p>{{/if}}
  <div id="low-1" class="jd-obstacle jd-snowball"></div>
  <div id="low-2" class="jd-obstacle jd-snowball"></div>
  <div id="high-1" class="jd-obstacle jd-bat"></div>
  <div id="high-2" class="jd-obstacle jd-bat"></div>
</div>
```

`pointer-events: none` on the ground and text keeps them from covering what's beneath them for the mouse.

Each obstacle waits off the right edge, at its height: snowballs low, bats high.

```css [public/games/jump-and-duck/jump-and-duck.css]
.jd-obstacle {
  position: absolute;
  left: 110%;
  transform: translate(-50%, -50%);
}

/* A snowball: low, where only a jump clears it */
.jd-snowball {
  top: 82%;
…
/* A bat: high, where only a duck clears it */
.jd-bat {
  top: 22%;
```

**Look for:** open the warm-up. You stand in front of a dim evening sky, with the ground at your feet. No obstacles
yet: they're off the screen.

## Step 3: the scene's data and state

The scene's `data` holds the numbers the rules use, so they're easy to tune. Its state holds the score and lives.

```json [public/game-repository.json]
"data": {
  "target": 15,
  "baseMs": 4000,
  "minMs": 2500,
  "speedUp": 50
},
"initialState": {
  "score": 0,
  "lives": 3,
  "over": false,
  "won": false
},
"resetStateOnShow": true,
```

## Step 4: send the obstacles across

A `start` rule fires as the scene starts. Each obstacle gets an `item-move` [effect](../special-effects.md#item-move),
from just off the right edge to just off the left. Positions are percentages of the scene
([coordinates](../special-effects.md#coordinate-system)).

```json [public/game-repository.json]
{
  "on": {
    "start": true
  },
  "do": [
    {
      "effect": "item-move",
      "target": "#low-1",
      "start": {
        "left": 110,
        "top": 82
      },
      "end": {
        "left": -10,
        "top": 82
      },
      "durationMs": "max(data.minMs, data.baseMs - state.score * data.speedUp)",
      "delayMs": "random(0, 1500)"
    },
```

- `durationMs` and `delayMs` can be [expressions](../game-data.md#expressions), worked out as the effect starts. The
  crossing speeds up as the score rises, down to `minMs`.
- `random(0, 1500)` staggers the start, so each run differs. The other obstacles start later.

When an obstacle reaches the far side, an `effectEnd` rule sends it again, after a random pause:

```json [public/game-repository.json]
{
  "on": {
    "effectEnd": "item-move",
    "target": "#low-1"
  },
  "if": "not state.over",
  "do": [
    {
      "effect": "item-move",
      "target": "#low-1",
…
      "delayMs": "random(300, 2500)"
    }
  ]
},
```

**Look for:** snowballs roll along the ground, and bats fly across at head height, faster as the run goes on.

## Step 5: body-part interactions

A camera player interacts with an element when part of their silhouette covers it
([how interactions work](../camera-mode.md#how-interactions-work)). A snowball costs a life when it touches the
player's body; a bat when it touches their head. So the player jumps to let snowballs pass beneath them, and ducks
under bats.

```json [public/game-repository.json]
{
  "on": {
    "interact": ["body-enter", "mouse-enter"],
    "target": ".jd-snowball",
    "threshold": 0.1
  },
  "if": "not state.over",
  "do": [
    {
      "set": {
        "lives": "state.lives - 1"
      }
    },
    {
      "sound": "pop"
    }
  ]
},
{
  "on": {
    "interact": ["head-enter", "mouse-enter"],
    "target": ".jd-bat",
    "threshold": 0.3
  },
```

- `threshold` is how much of the body part must be inside the element: a tenth of the body for a snowball, which is
  small next to a whole silhouette, and almost a third of the head for a bat.
- `mouse-enter` is the mouse's stand-in: moving the pointer onto an obstacle costs a life too, so the mouse player
  keeps the pointer clear.
- The target is a class, so one rule covers both snowballs.

Jump and duck needs no jump interaction, as a jump is just keeping clear. When a jump itself should do something, use
`jump`, `jump-from` or `jump-onto` ([jumps](../camera-mode.md#jumps)).

**Look for:** a snowball that hits you pops, and the lives count drops. With `?debug=true`, each player is tinted,
with their head, hands and feet marked, so you can see what the camera thinks is touching what
([debugging](../camera-mode.md#debugging)).

## Step 6: timers, winning and losing

An `every` rule adds a point a second while the run lasts:

```json [public/game-repository.json]
{
  "on": {
    "every": 1000
  },
  "if": "not state.over",
  "do": [
    {
      "set": {
        "score": "state.score + 1"
      }
    }
  ]
},
```

Two `when` rules end the run. Reaching the target stops the obstacles with the `stop`
[effect](../special-effects.md#stopping-an-effect), which puts them back off the screen where the template has them,
and completes the challenge:

```json [public/game-repository.json]
{
  "on": {
    "when": "state.score >= data.target and not state.over"
  },
  "do": [
    {
      "set": {
        "over": "true",
        "won": "true"
      }
    },
    {
      "effect": "stop",
      "target": ".jd-obstacle",
      "stop": "item-move"
    },
    {
      "completeChallenge": true,
      "delayMs": 1500
    },
```

Running out of lives does the same, but resets the challenge instead, for another go:

```json [public/game-repository.json]
{
  "on": {
    "when": "state.lives <= 0 and not state.over"
  },
…
    {
      "resetChallenge": true,
      "delayMs": 1500
    }
```

## Step 7: a countdown before each run

A **reset scene** shows in place of its scene until one of its rules finishes it
([reset scenes](../game-data.md#reset-scenes)). Until then, the run's rules and timers wait. With
`"showOn": "every-show"`, the countdown comes back each time the run starts, including after `resetChallenge`.

```json [public/game-repository.json]
"resetScene": {
  "showOn": "every-show",
  "component": {
    "type": "template",
    "data": {},
    "initialState": {
      "count": 3
    },
    "rules": [
      {
        "on": {
          "every": 1000
        },
        "do": [
          {
            "set": {
              "count": "state.count - 1"
            }
          },
          {
            "sound": "tick"
          }
        ]
      },
      {
        "on": {
          "after": 3500
        },
        "do": [
          {
            "finishReset": true
          }
        ]
      }
    ],
```

<!-- prettier-ignore -->
```html [public/games/jump-and-duck/ready.html]
<p id="jd-countdown" class="jd-countdown">{{#if state.count}}{{state.count}}{{else}}Go!{{/if}}</p>
```

**Look for:** 3, 2, 1, Go!, then the run. Lose all your lives, and after "Ouch! Back to the start…" the countdown
begins again. Reach 15, and fireworks.

## Next

- [A 2.5D scene](2-5d-scene.md): scenes on the floor, where players walk among the items.
- [Special effects](../special-effects.md): effects on items and players, such as making a player fall or spin away.
- [Camera mode](../camera-mode.md): what the player sees, and how players are tracked.
