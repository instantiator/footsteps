# Game data

A game is one `GameData` object (`src/entities/data/GameData.ts`), authored as JSON inside a [game repository](game-repository-data.md). Its JSON schema, generated from the types, is `public/schemas/game-data-schema.json`. Check a game with `./validate-game.sh path/to/game.json`.

## Structure

```text
GameData
├── title, gameContainerStyle          shown as-is; the style applies to the game's outer container
├── config?                            { sequential, autoAdvanceStages }
├── modules?.camera?                   { enabled }: show the player's camera silhouette
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
- `backgroundStyle` / `foregroundStyle`: CSS for the layer's container.
- `backgroundTemplateStyle` / `foregroundTemplateStyle`: CSS for the rendered template.

String values in all four styles may use Handlebars over the [template data](#template-data), for example `"backgroundImage": "url('{{resources.bg}}')"`. Numbers pass through as they are. Any other kind of value is an error that names the style key.

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

`credits` lists the third-party media the game uses. The landing page shows them under the game: each `text` is a link when `url` is set, and plain text otherwise. The app's own media is credited in `src/components/landing/Attributions.tsx`. Magic-trifle credits its music, sound effect and bubble text this way.

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

A scroll's templates also get `text`, the current page's text, and `lines`, its non-blank lines.

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
  "clickIdToStageId": { "stages-link-stage-1": "stage-1" }
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
