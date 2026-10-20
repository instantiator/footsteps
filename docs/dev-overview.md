# Developer overview

Footsteps is a Vite + React + TypeScript app. It uses React Router's framework mode to prerender every page to static HTML for GitHub Pages ([ADR 0001](ADRs/0001-replace-vite-react-ssg-with-react-router-framework-mode.md)).

## Prerequisites

- `bash`, `git`, and Node 26 (`engines.node` in `package.json`; LTS from 2026-10-28)
- [Code formatting configuration](code-formatting.md)
- The `dev-qual` submodule: `git submodule update --init`

## Layout

| Path                         | What it is                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `react-router.config.ts`     | Static build settings: no server, the routes to prerender, the base path      |
| `src/root.tsx`               | The HTML document every page renders into (head tags, fonts)                  |
| `src/routes.ts`              | Route config: `/`, `/game/:id`, `/game/:id/json`                              |
| `src/pages/`, `src/Home.tsx` | Route modules (one page each)                                                 |
| `src/components/`            | Game engine UI: layers, displays, camera, and the game logic in `core/logic/` |
| `src/providers/`             | React contexts: repository, game data, game state, music, feature flags       |
| `tests/`                     | Vitest unit and component tests                                               |

## Invocations

| Command                  | Does                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Dev server on <http://localhost:5173>                                                                                   |
| `npm run build`          | Typecheck, then prerender every page to a static site in `dist/client/`                                                 |
| `npm run build:gh-pages` | As `build`, under the GitHub Pages base path: `$BASE_URL`, or `/footsteps/` if unset (see: [deployment](deployment.md)) |
| `npm run preview`        | Serve `dist/client/` locally                                                                                            |
| `npm test`               | Run the tests once                                                                                                      |
| `npm run test:run`       | Validate `public/game-repository.json`, then run the tests                                                              |
| `npm run lint:check`     | ESLint, failing on any warning                                                                                          |
| `npm run typecheck`      | TypeScript, no output                                                                                                   |
| `npm run docs:api`       | Regenerate the API reference in `docs/tsdoc/` from the TSDoc comments, failing on any undocumented export               |
| `npm run format`         | Prettier, rewriting files (`format:check` only reports)                                                                 |

`dev`, `build`, `lint`, `preview`, and `test` first run `pre-build.sh`, which regenerates `src/assets/license-report.json` and the JSON schemas.

## Quality gate

`dev-qual/scripts/check.sh` runs formatting, lint, typecheck, build, tests, shell/workflow/markdown linters, and an [aislop](https://www.npmjs.com/package/aislop) scan. `--fast` (format, lint, typecheck only) runs as the git pre-commit hook; the full gate runs as the pre-push hook, and in CI on every pull request and push to `main` (`.github/workflows/check.yaml`), which shows test results as annotations and a job summary, with the JUnit file as a downloadable artefact. Before committing, the hook also runs `scripts/pre-commit-fixups.sh`, which regenerates `docs/tsdoc/` whenever `src/`, `typedoc.json` or `package.json` is staged, and the JSON schemas whenever `src/entities/` is staged, and adds them to the commit. An export without a TSDoc comment fails the commit. aislop compares against `.aislop/ci-baseline.json` (accepted findings) and `ci.failBelow` in `.aislop/config.yml`.

## Sample games

Every game in the local repository, `public/game-repository.json`, is prerendered at its own URL:

| Game           | Game URL                                  | Game data URL                                  |
| -------------- | ----------------------------------------- | ---------------------------------------------- |
| `magic-trifle` | <http://localhost:5173/game/magic-trifle> | <http://localhost:5173/game/magic-trifle/json> |

`public/test-repository.json` holds `test-game`, which isn't in the local repository, so `/game/test-game` shows "not found".

## Schemas

`pre-build.sh` generates JSON schemas from the TypeScript types:

| Type             | Schema                                       |
| ---------------- | -------------------------------------------- |
| `GameRepository` | `public/schemas/game-repository-schema.json` |
| `GameData`       | `public/schemas/game-data-schema.json`       |

### Clickable elements in templates

Overview templates make elements clickable by giving them an `id` that the display's `clickIdToStageId` maps to a stage. For keyboard players, also mark each element a player can currently use with `role="button"`, `tabindex="0"`, and a label (`alt` on an image, or `aria-label`): the layer then treats Enter or Space on it as a click. On the title screen, Enter or Space anywhere moves on, as a click does. See `public/games/magic-trifle/overview/foreground.hbs`.

### Validate data

```bash
./validate-repository.sh public/game-repository.json
```

```bash
./validate-game.sh path/to/some-game.json
```
