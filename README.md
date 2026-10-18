# Christmas Game 2025

This game is built on Footsteps, a puzzle game engine and interface (a Vite + React + TypeScript app).

- [Developer overview](docs/dev-overview.md): running locally, schemas, and validating game data.
- [Code formatting](docs/code-formatting.md): Prettier and ESLint setup.

## Deployment to GitHub Pages

On every push to `main`, GitHub Actions runs the quality gate and, only if it passes, builds the application statically and deploys it to GitHub Pages. To use it, enable GitHub Pages in the repository settings, with **GitHub Actions** as the source.

The site's base path (`/<repo-name>/`, or `/` on a custom domain) is read from the Pages settings at deploy time, so renaming the repository or adding a custom domain needs no code changes. See [GitHub Pages](docs/dev-overview.md#github-pages) in the developer overview.
