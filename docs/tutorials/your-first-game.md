# Your first game

This tutorial builds a small game, played with the mouse, from an empty entry in the game repository up to a title, a
list of stages, and a challenge that takes an answer. It follows the **Demo (no camera)** game as it was when it stood alone, so the snippets are quoted from commit
`140d903e` of `public/game-repository.json` and `public/games/demo-no-camera/`. Its stages have since joined the
**Demo scenes** game (`/game/rules-demo`), under `public/games/rules-demo/demo-no-camera/`.

You'll need the app running locally (`npm run dev`; see the [developer overview](../dev-overview.md)), and a text
editor. You don't need to know how Footsteps works inside.

## How a game fits together

A game is one entry in a **game repository**, a JSON file. The site's own repository is `public/game-repository.json`.
A game has:

- some **overview scenes**: the screens shown when no stage is open, such as a title and a list of stages;
- **stages**, each holding one or more **challenges**, each with scenes of its own;
- **resources**: the files it uses, such as pictures, sounds, stylesheets and templates.

A **scene** says when it shows (its `purpose`) and how it's drawn (its `component`). Most scenes are **templates**:
HTML, with values filled in by [Handlebars](https://handlebarsjs.com/guide/). [Game data](../game-data.md#structure)
has the whole structure.

## Step 1: an entry in the repository

Add the game to `games` in the repository file. Its key is its id, which goes in its URLs.

```json [git:140d903e:public/game-repository.json]
"demo-no-camera": {
  "id": "demo-no-camera",
  "title": "Demo (no camera)",
  "description": "Light the lamps, answer a riddle on a scroll, and pick the right door: a demonstration of 2D scenes, played with the mouse alone.",
…
  "modules": { "scene": "2D", "avatar": { "mode": "mouse" } },
  "config": { "sequential": false, "autoAdvanceStages": false },
…
  "gameContainerStyle": { "fontFamily": "system-ui, sans-serif" }
},
```

- `modules` says the game's scenes are flat (`2D`), and that the player plays with the mouse. The
  [scene and avatar modes](../game-data.md#scene-and-avatar-modes) can be changed for any scene.
- `config.sequential: false` unlocks every stage at the start, so the player can take them in any order.
  `autoAdvanceStages: false` returns to the list of stages after each one
  ([details](../game-data.md#structure)).
- `gameContainerStyle` is CSS for the box the whole game is drawn in.

A game also needs `scenes` and `stages`, which the next steps add. Until it has a scene to start on, it won't load.

## Step 2: a title

The first overview scene is the title. Its template is a file next to the game's other files, so its `sourceType` is
`relative`: relative to the repository file.

```json [git:140d903e:public/game-repository.json]
"scenes": [
  {
    "purpose": "game-overview-title",
    "component": {
      "type": "template",
      "data": {},
      "foregroundTemplate": { "sourceType": "relative", "templateSource": "games/demo-no-camera/title.html" },
      "foregroundTemplateStyle": { "width": "100%", "height": "100%" }
    }
  },
```

The template shows the game's own title and description. `gameState` is one of the values every template can use
([template data](../game-data.md#template-data)).

```html [git:140d903e:public/games/demo-no-camera/title.html]
<div id="ndc-title" class="ndc-screen ndc-title" role="button" tabindex="0">
  <h1>{{gameState.gameData.title}}</h1>
  <p>{{gameState.gameData.description}}</p>
  <p class="ndc-hint">Click anywhere to start.</p>
</div>
```

A click on the title that no rule takes moves on to the list of stages, so the title needs no rules.
`role="button"` and `tabindex="0"` let keyboard players start the game too.

**Look for:** open `/game/<your-game-id>/play`. The title and description show, in the browser's plain style for now.

## Step 3: a stylesheet

The title uses classes such as `ndc-screen`. They live in a CSS file, which is a **resource**: a name for a file. The
game loads every resource named in `stylesheets`.

```json [git:140d903e:public/game-repository.json]
"stylesheets": ["ndc-css"],
"resources": {
  "ndc-css": { "type": "local", "target": "games/demo-no-camera/demo-no-camera.css" },
```

A `local` resource is a path on this site, under `public/`. [Resources](../game-data.md#resources) lists the other
types. Prefix your class names with something short for your game, as `ndc-` is here, so they don't clash with other
games or with Footsteps' own.

```css [public/games/rules-demo/demo-no-camera/demo-no-camera.css]
.ndc-screen {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 4vmin;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4vmin;
  background: linear-gradient(#264653, #2a9d8f);
  font-family: system-ui, sans-serif;
  color: white;
  text-align: center;
}
```

The screen fills the scene and centres what's on it. Sizes in `vmin` (or `%`) suit any screen.

**Look for:** reload the play page. The title is white on a teal gradient.

## Step 4: the landing tile

The landing page at `/game/<your-game-id>` shows the game on a tile. `tileGraphic` names the resource to draw behind
the title and description ([landing tile](../game-data.md#landing-tile)).

```json [git:140d903e:public/game-repository.json]
"tileGraphic": "tile",
…
"tile": { "type": "local", "target": "games/demo-no-camera/tile.svg" },
```

**Look for:** the home page lists the game with its picture. Its landing page shows badges for what the game needs:
"2D" and "No camera", from `modules`, and how many stages and challenges it has.

## Step 5: stages and a challenge

A stage holds challenges, and a challenge has scenes and a solution. The riddle stage has one challenge: a scroll
that asks a question and takes an answer.

```json [git:140d903e:public/game-repository.json]
{
  "id": "riddle",
  "challenges": [
    {
      "id": "answer-the-riddle",
      "solution": { "answers": ["keyboard", "a keyboard"] },
      "scenes": [
        {
          "purpose": "challenge-in-progress",
          "component": {
            "type": "scroll",
            "data": {},
            "contents": [
              {
                "text": "I have keys, but open no locks.\nI have space, but no room.\nYou can enter, but you can't go in."
              },
              { "text": "What am I?", "showInput": true, "label": "Your answer" }
            ]
          }
        }
      ]
    }
  ]
},
```

- A `scroll` is a built-in component: pages of text on a paper scroll. `showInput` adds a box for the answer on its
  last page.
- `solution.answers` lists the answers that solve the challenge. By default, case and spaces don't matter.
- `challenge-in-progress` is the scene shown while the challenge is open. A challenge can also have a title and a
  completed scene ([scenes](../game-data.md#scenes)).

## Step 6: a list of stages

The second overview scene, `game-overview-stages`, lists the stages and lets the player open one. Its `data` holds a
name for each stage, and its rules open a stage when its link is clicked.

```json [git:140d903e:public/game-repository.json]
{
  "purpose": "game-overview-stages",
  "component": {
    "type": "template",
    "data": { "names": { "lamps": "Light the lamps", "riddle": "A riddle", "doors": "Pick a door" } },
    "rules": [
      { "on": { "interact": "click", "target": "#stage-link-lamps" }, "do": [{ "enterStage": "lamps" }] },
      { "on": { "interact": "click", "target": "#stage-link-riddle" }, "do": [{ "enterStage": "riddle" }] },
      { "on": { "interact": "click", "target": "#stage-link-doors" }, "do": [{ "enterStage": "doors" }] }
    ],
    "foregroundTemplate": { "sourceType": "relative", "templateSource": "games/demo-no-camera/stages.html" },
    "foregroundTemplateStyle": { "width": "100%", "height": "100%" }
  }
}
```

The template draws a link for each stage. `{{#each gameState.stages}}` repeats for every stage, and inside it,
`@root.data` reaches the scene's `data` ([templating](../game-data.md#templating)). Each link's `id` is what a rule
targets.

<!-- prettier-ignore -->
```html [git:140d903e:public/games/demo-no-camera/stages.html]
<div class="ndc-screen">
  <h1>Choose a stage</h1>
  <div class="ndc-stages">
    {{#each gameState.stages}}
    <div id="stage-link-{{stage.id}}" class="ndc-stage-link{{#if showCompleted}} completed{{/if}}" role="button" tabindex="0">
      {{oneIndex}}. {{lookup @root.data.names stage.id}}{{#if showCompleted}} ✓{{/if}}
    </div>
    {{/each}}
  </div>
</div>
```

**Look for:** click the title. "Choose a stage" lists the stages. Click "A riddle": the scroll opens over the list.
Turn the page, type "keyboard", and the challenge is solved. The list comes back with the riddle ticked, and its link
coloured by `.ndc-stage-link.completed`.

The game's other two stages, the lamps and the doors, use rules and state to decide when they're solved. The
[next tutorial](scene-without-camera.md) builds them.

## Step 7: test and validate

- **Debug and the menu.** The **Menu** button at the top right has a list to go to any stage or challenge, a reset,
  and **Debug on**/**off**, which `?debug=true` in the URL also turns on. In a mouse-only game, debug shows little;
  it matters for the camera and the floor, in the later tutorials.
- **Start again.** Progress is saved in the browser. **New game** on the landing page starts afresh.
- **Validate.** Run `./validate-repository.sh public/game-repository.json --skip-urls`. It checks the file against
  the schema, that every resource file and template exists, and that resource names and stage links are real. A
  repository of your own works the same way; `./validate-game.sh` checks one game in a file of its own. `npm test`
  checks every game's rules.

```text
public/game-repository.json valid
Checking the repository's resource paths, templates and names...
0 problems found (examined … file targets, … URL, … resource names) (URL checks skipped).
Validation successful for public/game-repository.json.
```

A misspelt resource name, a missing file, or a rule with a mistake in it is reported with its path in the file, such
as `games.rules-demo.scenes[0].component.foregroundTemplate.templateSource`.

## Next

- [A scene without a camera](scene-without-camera.md): rules and state, for the lamps and the doors.
- [Game data](../game-data.md): everything a game can have, including [sounds](../game-data.md#sounds),
  [rewards](../game-data.md#reward) and [credits](../game-data.md#credits).
