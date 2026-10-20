# Game data

A game is one `GameData` object (`src/entities/data/GameData.ts`), authored as JSON inside a [game repository](game-repository-data.md). Its JSON schema, generated from the types, is `public/schemas/game-data-schema.json`. Check a game with `./validate-game.sh path/to/game.json`.

## Structure

```text
GameData
├── title, gameContainerStyle          shown as-is; the style applies to the game's outer container
├── config?                            { sequential, autoAdvanceStages }
├── modules?.camera?                   { enabled }: show the player's camera silhouette
├── resources?                         name → { type, target }        (see Resources)
├── displays: GameOverviewDisplay[]    the screens shown when no stage is open
└── stages: GameStageData[]
    ├── id
    ├── displays?: GameStageDisplay[]  a "shared" display behind the stage's challenges
    ├── challengeChunking?             how many challenges show at once (default 1)
    └── challenges: GameChallengeData[]
        ├── id
        ├── displays: GameChallengeDisplay[]
        └── solution: GameChallengeSolution
            └── answers, ignoreCase, trimWhitespace, ignoreWhitespace, autoAccept, hints
```

- **`config.sequential`** (default `true`) unlocks only the first stage at the start. Each completed challenge then unlocks the first stage that isn't complete. With `false`, every stage starts unlocked.
- **`config.autoAdvanceStages`** isn't read yet ([bug #3](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md)). The code itself decides what happens when a stage is complete: the game returns to the `game-overview-stages` display if it has one, and otherwise goes straight to the next incomplete stage.
- **`solution`**: an answer matches if it equals any of the `answers` after the optional case and whitespace normalisation. All three normalisations default to `true`. `autoAccept` and `hints` aren't used yet ([bug #4](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md)).

## Displays

Every display has a `purpose`, which says when it shows, and a `component`, which says how it renders (`src/entities/data/displays/`).

| Level     | Purposes                                                                | Chosen by                                                                                                                                          |
| --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game      | `game-overview-title`, `game-overview-stages`, `game-overview-complete` | `gameState.current.overviewDisplay`. The game starts on the title if it has one, otherwise on the stages.                                          |
| Stage     | `shared`                                                                | Shown whenever that stage is open                                                                                                                  |
| Challenge | `challenge-title`, `challenge-in-progress`, `challenge-completed`       | The first of these the challenge has, in that order ([bug #5](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md)) |

The selection code is `calcOverviewDisplay`, `calcStageDisplay` and `calcChallengeDisplay` in `src/components/core/logic/RenderDataUtils.ts`. Once every stage is complete, the overview switches to `game-overview-complete`, or falls back to the title, and then to the stages.

An overview display can also have **`clickIdToStageId`**, which maps element ids in its template to the stage a click on that element enters. Locked and completed stages ignore the click. Any click on the title screen moves on to the stages overview. For keyboard access, see [clickable elements in templates](dev-overview.md#clickable-elements-in-templates).

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
- `backgroundStyle` / `foregroundStyle`: CSS for the layer's container. Values may use Mustache.
- `backgroundTemplateStyle` / `foregroundTemplateStyle`: CSS for the rendered template. Values don't use Mustache ([bug #2](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md)).

The **`template`** type renders those templates and nothing more. The **`scroll`** type shows paged text on an old-paper image. Each entry in its `contents[]` is one page, with:

- `text`
- `showInput` and `label`: an answer box that checks the challenge's solution as the player types
- `media`: a `GameDisplayMediaData` audio clip, with optional `stillImageResource` and `motionImageResource` images that play and stop it

Without its own templates, a scroll shows the page text one paragraph per line.

## Resources

`resources` names the files a game uses. Each one is `{ type, target }`. `GameDataProvider` resolves each to an absolute URL when the game loads (`resolveResources` in `src/providers/GameDataProvider.tsx`):

| `type`     | `target` is resolved against                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local`    | This site's base URL (`import.meta.env.BASE_URL`)                                                                                                                                 |
| `relative` | The repository's location: its directory for a remote repository, or the site for a local one. Raw repositories can't use it ([details](game-repository-data.md#relative-paths)). |
| `url`      | Nothing: it must already be an absolute URL                                                                                                                                       |

If a resource can't be resolved, the game's loading state becomes `resource-error`. Media fields such as `media.resource` and `stillImageResource` refer to resources by name. Templates see all of them as `resources`, for example `{{resources.star}}`.

## Templating

Templates are [Mustache](https://mustache.github.io/mustache.5.html), rendered to HTML with **escaping off**, so values are inserted as raw HTML. A `GameDisplayTemplateSourceData` gives the template's `sourceType` and its `templateSource` or `content`:

| `sourceType` | Template comes from                                             |
| ------------ | --------------------------------------------------------------- |
| `embedded`   | `content`, inline                                               |
| `local`      | `templateSource`, a path on this site. Local repositories only. |
| `relative`   | `templateSource`, resolved like a `relative` resource           |
| `url`        | `templateSource`, as an absolute URL                            |

`resolveTemplateURL` in `src/providers/GameContentCacheHook.tsx` resolves fetched templates, which are cached for the life of the game.

### Template data

Every template, and every Mustache value in a container style, is rendered with `GameTemplateData` (`src/components/core/logic/RenderDataUtils.ts`):

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

A scroll's templates also get `text`, the current page's text, and `lines`, its non-blank lines.

### Example

The magic-trifle stages overview (`public/games/magic-trifle/overview/foreground.mustache`) draws a stepping stone per stage. Each stone's id matches the display's `clickIdToStageId`:

```json
{
  "purpose": "game-overview-stages",
  "component": {
    "type": "template",
    "foregroundTemplate": {
      "sourceType": "relative",
      "templateSource": "games/magic-trifle/overview/foreground.mustache"
    },
    "backgroundStyle": { "backgroundImage": "url('{{resources.blank-river}}')" },
    "data": {}
  },
  "clickIdToStageId": { "stages-link-stage-1": "stage-1" }
}
```

```mustache
{{#gameState.stages}}
  {{#showUnlocked}}
  <img id="stages-link-{{stage.id}}" src="{{resources.stepping-stone}}" role="button" tabindex="0"
       alt="Stage {{oneIndex}}: play" style="width: calc( 75vw / {{gameState.totalStages}} )" />
  {{/showUnlocked}}
{{/gameState.stages}}
```
