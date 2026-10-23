# Game data

A game is one `GameData` object (`src/entities/data/GameData.ts`), authored as JSON inside a [game repository](game-repository-data.md). Its JSON schema, generated from the types, is `public/schemas/game-data-schema.json`. Check a game with `./validate-game.sh path/to/game.json`, which validates its schema and that its resource files, templates and resource names can load.

## Structure

```text
GameData
├── title, description                 shown as-is; the description goes on the landing-page tile
├── tileGraphic?                       resource name of the tile's background image (see Landing tile)
├── gameContainerStyle                 applied to the game's outer container
├── config?                            { sequential, autoAdvanceStages }
├── modules?.camera?                   { enabled, preview? }: show the player's camera silhouette
├── resources?                         name → { type, target }        (see Resources)
├── sounds?                            resource names of music and sound effects (see Sounds)
├── reward?                            { animation, particleCount? }: celebration on stage completion
├── credits?                           [{ text, url? }]: credits for third-party media (see Credits)
├── stylesheets?                       resource names of CSS files to load (see Stylesheets)
├── displays: GameOverviewDisplay[]    the screens shown when no stage is open
└── stages: GameStageData[]
    ├── id
    ├── displays?: GameStageDisplay[]  a "shared" display behind the stage's challenges
    ├── challengeChunking?             how many challenges show at once (default 1)
    └── challenges: GameChallengeData[]
        ├── id
        ├── displays: GameChallengeDisplay[]
        └── solution: GameChallengeSolution
            └── answers, ignoreCase, trimWhitespace, ignoreWhitespace
```

- **`config.sequential`** (default `true`) unlocks only the first stage at the start. Each completed challenge then unlocks the first stage that isn't complete. With `false`, every stage starts unlocked.
- **`config.autoAdvanceStages`** decides what happens when a stage is complete. With `true`, the game goes straight to the next incomplete stage. Otherwise it returns to the `game-overview-stages` display if it has one, and goes straight on if it doesn't.
- **`solution`**: an answer matches if it equals any of the `answers` after the optional case and whitespace normalisation. All three normalisations default to `true`.

## Displays

Every display has a `purpose`, which says when it shows, and a `component`, which says how it renders (`src/entities/data/displays/`).

| Level     | Purposes                                                                | Chosen by                                                                                                 |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Game      | `game-overview-title`, `game-overview-stages`, `game-overview-complete` | `gameState.current.overviewDisplay`. The game starts on the title if it has one, otherwise on the stages. |
| Stage     | `shared`                                                                | Shown whenever that stage is open                                                                         |
| Challenge | `challenge-title`, `challenge-in-progress`, `challenge-completed`       | Unsolved: the first it has of title, in-progress, completed. Solved: of completed, in-progress, title.    |

The selection code is `calcOverviewDisplay`, `calcStageDisplay` and `calcChallengeDisplay` in `src/components/core/logic/RenderDataUtils.ts`. Once every stage is complete, the overview switches to `game-overview-complete`, or falls back to the title, and then to the stages.

An overview display can also have **`clickIdToStageId`**, which maps element ids in its template to
a `GameInteractionTarget`: the stage the element enters, which interactions it accepts, and the
threshold for camera interactions. A target without `interactions` accepts only `click`, and its
`threshold` defaults to `1`. Locked and completed stages ignore the interaction. Any click on the
title screen moves on to the stages overview. Clicks remain the keyboard-accessible route; for
keyboard access, see [clickable elements in templates](dev-overview.md#clickable-elements-in-templates).

### Camera settings

`modules.camera` switches camera mode on for a whole game:

```json
"modules": {
  "camera": { "enabled": true, "preview": true }
}
```

`preview` defaults to `true`. Any display can override either setting with
`"camera": { "enabled": false }` or `{ "preview": false }`; an unset field inherits from broader
displays.

Camera mode and its preview resolve separately, most specific first:

1. Any active challenge that sets it to `true` wins.
2. Otherwise, any active challenge that sets it to `false` wins.
3. Otherwise, the open stage's `shared` display.
4. Otherwise, the overview display.
5. Otherwise, the game's `modules.camera`.
6. Otherwise, the default: camera off, preview on.

The preview is always off while camera mode is off. See [camera mode](camera-mode.md) for what the
player sees and how the settings behave in practice.

### Interaction targets

A `GameInteractionTarget` names the stage to enter and, optionally, how to enter it:

```json
"clickIdToStageId": {
  "stages-link-stage-1": {
    "stage": "stage-1",
    "interactions": ["hand"],
    "threshold": 0.5
  }
}
```

| Interaction | The player does                                           |
| ----------- | --------------------------------------------------------- |
| `click`     | Clicks the element, or focuses it and presses Enter/Space |
| `hand`      | Puts either hand over the element                         |
| `foot`      | Puts either foot over the element                         |
| `head`      | Puts either side of their face over the element           |
| `body`      | Covers the element with their whole silhouette            |
| `any`       | Covers it with any single body part                       |
| `jump`      | Jumps with their feet inside the element                  |

`interactions` defaults to `["click"]`, so existing targets keep working as clicks. A target that
lists `click` still accepts clicks alongside its camera interactions. `threshold` is the fraction
of the chosen body part that must be inside the element (0–1, default `1`), clamped to that range.
Interactions fire once per approach, and re-arm when the player moves away.

Camera interactions are currently detected on overview displays only. The monitor and jump sequence
are described under [how interactions work](camera-mode.md#how-interactions-work).

### Layers

The screen is a stack of layers, and each display renders into two of them: background and foreground. From back to front:

1. overview
2. the open stage's `shared` display
3. the active challenges' backgrounds
4. the camera silhouette
5. the challenges' foregrounds
6. the HUD

The active challenges are the first chunk of `challengeChunking` challenges that still has one unsolved. They sit side by side.

### Components

Both component types carry `data`, a free-form object that templates see as `componentData`, and a background and a foreground, each with:

- `backgroundTemplate` / `foregroundTemplate`: a `GameDisplayTemplateSourceData` (see [Templating](#templating))
- `backgroundStyle` / `foregroundStyle`: CSS for the layer's container.
- `backgroundTemplateStyle` / `foregroundTemplateStyle`: CSS for the rendered template.

String values in all four styles may use Handlebars over the [template data](#template-data), for example `"backgroundImage": "url('{{resources.bg}}')"`. Numbers pass through as they are. Any other kind of value is an error that names the style key.

The **`template`** type renders those templates and nothing more. The **`dialog`** and **`scroll`** types show paged text on an image. Each entry in their `contents[]` is one page, with:

- `text`
- `showInput` and `label`: an answer box that checks the challenge's solution as the player types
- `media`: a `GameDisplayMediaData` audio clip, with optional `stillImageResource` and `motionImageResource` images that play and stop it

Without its own templates, a dialog or scroll shows the page text one paragraph per line. The text scrolls if it doesn't fit, and the page's audio, answer box and page arrows stay in view below it.

A **`dialog`** draws its pages on the game's own image:

- `imageResource`: the resource name of the background image. The image is scaled up or down to the largest size that fits the display, keeping its shape. The dialog works this out from the image itself, so it needs no size information. Without an image, the dialog fills its display.
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

A `GameDisplayTemplateSourceData` gives the template's `sourceType` and its `templateSource` or `content`:

| `sourceType` | Template comes from                                             |
| ------------ | --------------------------------------------------------------- |
| `embedded`   | `content`, inline                                               |
| `local`      | `templateSource`, a path on this site. Local repositories only. |
| `relative`   | `templateSource`, resolved like a `relative` resource           |
| `url`        | `templateSource`, as an absolute URL                            |

`resolveTemplateURL` in `src/providers/GameContentCacheHook.tsx` resolves fetched templates, which are cached for the life of the game.

### Template data

Every template, and every Handlebars value in a style, is rendered with `GameTemplateData` (`src/components/core/logic/RenderDataUtils.ts`):

| Field            | What it holds                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameState`      | The whole `GameState` (`gameData`, `stages`, and `current.stageId` / `current.overviewDisplay`), decorated by `decorateGameState` for templates. See below. |
| `componentData`  | This display's `component.data`, as authored                                                                                                                |
| `resources`      | Resource name → resolved URL                                                                                                                                |
| `challenge`      | The challenge's `GameChallengeData`. Challenge displays only, otherwise undefined.                                                                          |
| `challengeState` | Its `GameChallengeState` (`succeeded`, …). Challenge displays only.                                                                                         |

`decorateGameState` (`src/components/core/logic/TemplateUtils.ts`) adds `gameState.totalStages`, and to each entry of `gameState.stages`, alongside `stage`, `availability` and `completion`:

- `index` and `oneIndex`: the stage's position, counting from 0 or 1
- `showCompleted`: the stage is complete
- `showUnlocked`: the stage is unlocked and not complete
- `showLocked`: the stage is locked

A dialog's or scroll's templates also get `text`, the current page's text, and `lines`, its non-blank lines.

### Example

The magic-trifle stages overview (`public/games/magic-trifle/overview/foreground.hbs`) draws a stepping stone per stage. Each stone's id matches the display's `clickIdToStageId`:

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
    "data": {}
  },
  "clickIdToStageId": { "stages-link-stage-1": { "stage": "stage-1" } }
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
