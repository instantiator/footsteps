# Context

The core of this project is a game engine called `footsteps`. It's a vite/react/ts application, at the root of this repository.

## Invocations

- Run locally with: `npm run dev`
- Build static pages with: `npm run build`
- View the static preview with: `npm run preview`
- Build for GitHub Pages with: `npm run build:gh-pages`
- Run the tests once: `npm run test:run` (ideal an automatic test of new changes)
- Run the tests (and watch for changes): `npm run test` (for the user)
- Run linting with: `npm run lint`

The license file in `src/assets/license-report.json` is generated before each action.

Output from builds goes to the `dist/` directory. A simple way to serve from there is with `npx serve`.

## Run a dev server

Launch footsteps locally with `npm run dev`

All games are in the local repository at `public/game-repository.json` should be available at their own url.

| Game           | Game URL                                  | Game data URL                                  |
| -------------- | ----------------------------------------- | ---------------------------------------------- |
| `test-game`    | <http://localhost:5173/game/test-game>    | <http://localhost:5173/game/test-game/json>    |
| `magic-trifle` | <http://localhost:5173/game/magic-trifle> | <http://localhost:5173/game/magic-trifle/json> |

## Coding practices

When generating code, use formatting and style that matches the style of existing code - and follow good practices.

- Always test that the code you have written will build
- Always run the tests with `npm run test:run` to check for regressions
- Always check eslint for errors (ignore warnings unless they're new)
- After you change code, run the linter with the `--fix` option to update formatting

Explain new errors and warnings after a build, but only fix errors. After you've explained a warning to the user, ask if it's important to fix. Remember the answer.
