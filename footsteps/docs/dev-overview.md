# Developer overview

## Prerequisites

- The basics: `bash`, `git`, `npm`
- [Code formatting configuration](code-formatting.md)

## Invocations

- Run locally with: `npm run dev`
- Build static pages with: `npm run build`
- View the static preview with: `npm run preview`
- Build for GitHub Pages with: `npm run build:gh-pages`
- Run the tests once: `npm run test:run`
- Run the tests (and watch for changes): `npm run test`
- Run eslint with: `npm run lint`

The license file in `src/assets/license-report.json` is generated before each action.

Output from builds goes to the `dist/` directory. A simple way to serve from there is with `npx serve`.

## Run a dev server

Launch footsteps locally with `npm run dev`

## Sample games

All games in the local repository at `public/game-repository.json` are pre-built and made available at their own url.

| Game           | Game URL                                | Game data URL                                |
| -------------- | --------------------------------------- | -------------------------------------------- |
| `test-game`    | <http://localhost:5173/game/test-game>    | <http://localhost:5173/game/test-game/json>    |
| `magic-trifle` | <http://localhost:5173/game/magic-trifle> | <http://localhost:5173/game/magic-trifle/json> |

## Schemas

JSON schemas are generated and placed into the `src/assets/` directory by the `pre-build.sh` script.

| Type             | Schema                               |
| ---------------- | ------------------------------------ |
| `GameRepository` | `public/game-repository-schema.json` |
| `GameData`       | `public/game-data-schema.json`       |

### Validate data

```bash
./validate-repository.sh public/game-repository.json
```

```bash
./validate-game.sh path/to/some-game.json
```

## GitHub Pages

The app is served through GitHub Pages, and there's a GitHub Actions workflow to deploy to GitHub Pages in `.github/workflows/deploy-pages.yaml`
