# A scene without a camera

This tutorial builds two scenes that the player solves with the mouse: three lamps to light, and three doors to pick
from. Along the way it covers clickable elements, a scene's **state**, the **rules** that change it, and the effects
and rewards rules can trigger. It follows the **Demo (no camera)** game's "Light the lamps" and "Pick a door" stages,
and finishes with its scroll.

Start from [your first game](your-first-game.md), which builds the rest of this game. Every snippet here is quoted
from `public/game-repository.json` and `public/games/demo-no-camera/`.

## The `mouse` avatar

The game's `modules` set `"avatar": { "mode": "mouse" }`: the player plays by clicking and moving the mouse, and
there's no camera. Rules that react to the mouse are `click`, `mouse-enter` and `mouse-exit`
([interactions](../game-data.md#interactions)). Clicks also come from the keyboard: an element with `tabindex="0"`
can be focused with Tab and clicked with Enter or Space.

## The lamps

### Step 1: the scene and its template

Start with a challenge whose `challenge-in-progress` scene is a template. Its solution has no answers, because a rule
will complete it instead.

```json [public/game-repository.json]
{
  "id": "lamps",
  "challenges": [
    {
      "id": "light-the-lamps",
      "solution": { "answers": [] },
      "scenes": [
        {
          "purpose": "challenge-in-progress",
          "component": {
            "type": "template",
            "data": {},
…
            "foregroundTemplate": {
              "sourceType": "relative",
              "templateSource": "games/demo-no-camera/lamps.html"
            },
            "foregroundTemplateStyle": { "width": "100%", "height": "100%" }
```

The template draws three lamps. Each has an `id` for a rule to target, and is a button to screen readers and the
keyboard.

<!-- prettier-ignore -->
```html [public/games/demo-no-camera/lamps.html]
<div class="ndc-lamps">
  <div id="lamp-1" class="ndc-lamp{{#if state.lamp1}} lit{{/if}}" role="button" tabindex="0" aria-label="Lamp 1"></div>
  <div id="lamp-2" class="ndc-lamp{{#if state.lamp2}} lit{{/if}}" role="button" tabindex="0" aria-label="Lamp 2"></div>
  <div id="lamp-3" class="ndc-lamp{{#if state.lamp3}} lit{{/if}}" role="button" tabindex="0" aria-label="Lamp 3"></div>
</div>
```

A lamp is dark until it has the `lit` class:

```css [public/games/demo-no-camera/demo-no-camera.css]
.ndc-lamp {
  width: 14vmin;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #3d405b;
  cursor: pointer;
  transition:
    background 0.3s,
    box-shadow 0.3s;
}

.ndc-lamp.lit {
  background: #ffd166;
  box-shadow: 0 0 6vmin #ffd166;
}
```

**Look for:** open the game, and choose "Challenge: 1.1" in the **Menu**'s list and **Go** to open the lamps directly. Three dark lamps.
Clicking them does nothing yet.

### Step 2: state

A scene's **state** is a set of values that its rules change and its templates show
([state](../game-data.md#state)). The lamps scene starts with every lamp off:

```json [public/game-repository.json]
"initialState": { "lamp1": false, "lamp2": false, "lamp3": false, "done": false },
"resetStateOnShow": true,
```

State is saved with the game, so it survives a reload. `resetStateOnShow` starts it afresh each time the scene is
shown, so a player who leaves and comes back finds the lamps dark again.

The template reads it as `state`: `{{#if state.lamp1}} lit{{/if}}` adds `lit` while `lamp1` is true. When state
changes, the template is patched in place rather than redrawn, so the CSS transition fades the lamp up
([elements that animate](../game-data.md#elements-that-animate-or-keep-state)).

### Step 3: a rule for each lamp

A rule has a trigger (`on`), an optional condition (`if`), and actions (`do`)
([rules](../game-data.md#rules)). Each lamp's rule toggles its value, and plays a sound:

```json [public/game-repository.json]
{
  "on": { "interact": "click", "target": "#lamp-1" },
  "if": "not state.done",
  "do": [{ "set": { "lamp1": "not state.lamp1" } }, { "sound": "chime" }]
},
```

- `target` is a CSS selector, so `.ndc-lamp` would match every lamp; here each lamp has its own rule.
- `set` works out each value as an [expression](../game-data.md#expressions) over the state:
  `not state.lamp1` flips it.
- `if` stops the lamps changing once the puzzle is done.
- `sound` plays a resource by name: `chime` is a `local` resource in the game's `resources`.

**Look for:** each click lights a lamp, with a chime, and a second click puts it out.

### Step 4: finish when all are lit

A `when` rule fires when its expression turns true, after any change of state:

```json [public/game-repository.json]
{
  "on": { "when": "state.lamp1 and state.lamp2 and state.lamp3" },
  "do": [
    { "set": { "done": "true" } },
    { "completeChallenge": true, "delayMs": 1000 },
    { "sound": "fanfare" },
    { "reward": { "animation": "sparkles", "particleCount": 80 } }
  ]
}
```

- `completeChallenge` solves the challenge. `delayMs` waits a second first, so the player sees the lamps lit.
- `reward` bursts sparkles across the screen ([rewards](../special-effects.md#rewards)).

The template's message shows the new state:

<!-- prettier-ignore -->
```html [public/games/demo-no-camera/lamps.html]
<p class="ndc-message">{{#if state.done}}All lit. Well done!{{else}}Click each lamp to light it. Click a lit one to put it out.{{/if}}</p>
```

**Look for:** light all three. "All lit. Well done!", a fanfare and sparkles; a second later, the list of stages, with
"Light the lamps" ticked. The **Menu**'s **Reset** starts the challenge again.

## The doors

### Step 5: wrong answers that shake

Three doors, one right. The template is like the lamps', with a message that changes when the player picks wrong:

<!-- prettier-ignore -->
```html [public/games/demo-no-camera/doors.html]
<p id="doors-message" class="ndc-message">{{#if state.wrong}}Not that one. Try another.{{else}}One of these doors hides the prize. Which one?{{/if}}</p>
<div class="ndc-doors">
  <div id="door-1" class="ndc-door" role="button" tabindex="0" aria-label="Red door">1</div>
  <div id="door-2" class="ndc-door ndc-door-green" role="button" tabindex="0" aria-label="Green door">2</div>
  <div id="door-3" class="ndc-door ndc-door-blue" role="button" tabindex="0" aria-label="Blue door">3</div>
</div>
<p class="ndc-hint">A clue: it's the colour of grass.</p>
```

A wrong door sets `wrong`, and shakes with the `quake` [effect](../special-effects.md#quake):

```json [public/game-repository.json]
"initialState": { "wrong": false },
"resetStateOnShow": true,
"rules": [
  {
    "on": { "interact": "click", "target": "#door-1" },
    "do": [
      { "set": { "wrong": "true" } },
      { "effect": "quake", "target": "#door-1", "dx": 1, "durationMs": 400 }
    ]
  },
```

### Step 6: the right door

The green door completes the challenge at once, with fireworks:

```json [public/game-repository.json]
{
  "on": { "interact": "click", "target": "#door-2" },
  "do": [
    { "completeChallenge": true },
    { "sound": "fanfare" },
    { "reward": { "animation": "fireworks", "particleCount": 150 } }
  ]
}
```

**Look for:** the red and blue doors shake and change the message; the green one sets off fireworks. Once every stage is
done, the game is complete.

## Scrolls, dialogs and answers

The riddle stage, from [your first game](your-first-game.md#step-5-stages-and-a-challenge), needs no rules: a
`scroll` component shows pages of text, and `showInput` puts an answer box on a page. The answer is checked against
the challenge's `solution` as the player types.

```json [public/game-repository.json]
{ "text": "What am I?", "showInput": true, "label": "Your answer" }
```

A `dialog` is the same, drawn on your own picture instead of the scroll's paper: give it an `imageResource`, and
`imageMargins` to keep the text inside the picture ([components](../game-data.md#components)). Either can have its own
templates, state and rules, like any other component. A page can also carry a sound clip, with pictures that play and
stop it.

## Next

- [A 2D scene](2d-scene.md): the camera, with players drawn between the background and foreground.
- [Rules and state](../game-data.md#rules-and-state): every trigger and action, timers, and reset scenes.
- [Special effects](../special-effects.md): effects on items and players.
