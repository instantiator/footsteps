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

| Command                  | Does                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Dev server on <http://localhost:5173>                                                                                         |
| `npm run build`          | Typecheck, then prerender every page to a static site in `dist/client/`                                                       |
| `npm run build:gh-pages` | As `build`, under the GitHub Pages base path: `$BASE_URL`, or `/2025-xmas-game/` if unset (see [GitHub Pages](#github-pages)) |
| `npm run preview`        | Serve `dist/client/` locally                                                                                                  |
| `npm test`               | Run the tests once                                                                                                            |
| `npm run test:run`       | Validate `public/game-repository.json`, then run the tests                                                                    |
| `npm run lint:check`     | ESLint, failing on any warning                                                                                                |
| `npm run typecheck`      | TypeScript, no output                                                                                                         |
| `npm run format`         | Prettier, rewriting files (`format:check` only reports)                                                                       |

`dev`, `build`, `lint`, `preview`, and `test` first run `pre-build.sh`, which regenerates `src/assets/license-report.json` and the JSON schemas.

## Quality gate

`dev-qual/scripts/check.sh` runs formatting, lint, typecheck, build, tests, shell/workflow/markdown linters, and an [aislop](https://www.npmjs.com/package/aislop) scan. `--fast` (format, lint, typecheck only) runs as the git pre-commit hook; the full gate runs as the pre-push hook, and in CI on every pull request and push to `main` (`.github/workflows/check.yaml`), which shows test results as annotations and a job summary, with the JUnit file as a downloadable artefact. aislop compares against `.aislop/ci-baseline.json` (accepted findings) and `ci.failBelow` in `.aislop/config.yml`.

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

Overview templates make elements clickable by giving them an `id` that the display's `clickIdToStageId` maps to a stage. For keyboard players, also mark each element a player can currently use with `role="button"`, `tabindex="0"`, and a label (`alt` on an image, or `aria-label`): the layer then treats Enter or Space on it as a click. On the title screen, Enter or Space anywhere moves on, as a click does. See `public/games/magic-trifle/overview/foreground.mustache`.

### Validate data

```bash
./validate-repository.sh public/game-repository.json
```

```bash
./validate-game.sh path/to/some-game.json
```

## GitHub Pages

The site is fully static: no server runs at any point after the build. React Router renders the pages in Node during the build, then `finish-static-build.sh`:

- deletes that build-time renderer (`dist/server/`);
- makes the SPA fallback `404.html`, which Pages serves for any path without a page of its own, so client-side routing can handle it;
- under a base path, moves the pages to where Pages serves them (React Router writes them one folder too deep).

`.github/workflows/deploy-pages.yaml` runs the tests, builds with `build:gh-pages`, and deploys `dist/client/` to GitHub Pages on every push to `main`.

### Base path

Pages serves this repository at `/<repo-name>/`, or at `/` on a custom domain, and the build must use the same base path, or assets and direct links return 404. `BASE_URL` is the single setting: Vite uses it for asset URLs, React Router uses it as the router's `basename`, `finish-static-build.sh` uses it to place the pages, and the app reads it as `import.meta.env.BASE_URL`.

- **Deploys** set it from the Pages settings (`actions/configure-pages`'s `base_path`), so renaming the repository or adding a custom domain needs no changes.
- **Local and PR builds** (`npm run build:gh-pages`) default to `/2025-xmas-game/`. Change that default in `package.json` after a rename, or run `BASE_URL=/new-name/ npm run build:gh-pages`. Only the PR check's layout test uses it; it doesn't affect deploys.
- `npm run dev`, `npm run build`, and `npm run preview` use `/`.
