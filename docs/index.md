# Documentation

Published as HTML at <https://instantiator.dev/footsteps/docs/>, with the API reference under `/tsdoc/`.

- [Developer overview](dev-overview.md): running locally, schemas, and validating game data.
- [Playing a game](game-play.md): routes, the landing page, permissions, saved progress, and keep-awake.
- [Deployment](deployment.md): deployment details.
- [Game data](game-data.md): how a game's data, displays, resources, and templates fit together.
- [Game repository data](game-repository-data.md): the repository file that holds games, and where it's loaded from.
- [Camera mode](camera-mode.md): what camera mode is, and how the camera view is layered into the game.
- [Manual testing](testing/manual-testing.md): camera checks with a real webcam, and how to run the browser suite.
- [API reference](/tsdoc/){target="_blank"}: generated from the TSDoc comments in `src/` by `npm run docs:api`, and rendered as HTML by TypeDoc.
- [Code formatting](code-formatting.md): prettier and ESLint setup, and editor integration.
- [Outstanding issues](outstanding-issues.md): deferred work and when to act on it.

## ADRs

- [0001 Replace vite-react-ssg with React Router framework mode](ADRs/0001-replace-vite-react-ssg-with-react-router-framework-mode.md)
- [0002 Camera interactions](ADRs/0002-camera-interactions.md)
- [0003 Save game progress in local storage](ADRs/0003-save-progress-in-local-storage.md)
