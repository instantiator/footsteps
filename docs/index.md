# Documentation

Published as HTML at <https://instantiator.dev/footsteps/docs/>, with the API reference under `/tsdoc/`.

- [Developer overview](dev-overview.md): running locally, schemas, and validating game data.
- [Playing a game](game-play.md): routes, the landing page, permissions, saved progress, and keep-awake.
- [Deployment](deployment.md): deployment details.
- [Game data](game-data.md): how a game's data, displays, resources, and templates fit together.
- [Game repository data](game-repository-data.md): the repository file that holds games, and where it's loaded from.
- [How filtrex works](filtrex.md): the expression language used by display rules, and why it is safe.
- [Configuration](configuration.md): app settings, the `.env` files, and URL query parameters.
- [Camera mode](camera-mode.md): what camera mode is, and how the camera view is layered into the game.
- [Manual testing](testing/manual-testing.md): camera checks with a real webcam, and how to run the browser suite.
- [API reference](/tsdoc/){target="_blank"}: generated from the TSDoc comments in `src/` by `npm run docs:api`, and rendered as HTML by TypeDoc.
- [Code formatting](code-formatting.md): prettier and ESLint setup, and editor integration.
- [Outstanding issues](outstanding-issues.md): deferred work and when to act on it.

## ADRs

- [0001 Replace vite-react-ssg with React Router framework mode](ADRs/0001-replace-vite-react-ssg-with-react-router-framework-mode.md)
- [0002 Camera interactions](ADRs/0002-camera-interactions.md)
- [0003 Save game progress in local storage](ADRs/0003-save-progress-in-local-storage.md)
- [0004 Vision optimisations](ADRs/0004-vision-optimisations.md)
- [0005 Vision models](ADRs/0005-vision-models.md)
- [0006 Display rules and state](ADRs/0006-display-rules-and-state.md)
- [0007 Camera flicker](ADRs/0007-camera-flicker.md)
- [0008 Jump detection](ADRs/0008-jump-detection.md)
- [0009 Reset displays and rule effects](ADRs/0009-reset-displays-and-rule-effects.md)
