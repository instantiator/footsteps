# Deployment

## Workflows

On every push to `main`, GitHub Actions runs checks. If the checks pass, it builds the application statically and deploys it to GitHub Pages.

See:

- `.github/workflows/check.yaml`
- `.github/workflows/deploy-pages.yaml`

Ensure that **GitHub Pages** is enabled in the repository settings, with **GitHub Actions** as the source.

The site's base path (`/<repo-name>/`, or `/` on a custom domain) is read from the Pages settings at deploy time, so renaming the repository or adding a custom domain needs no code changes.

See also:

- [GitHub Pages](dev-overview.md#github-pages) in the developer overview.

## Base path

Pages serves this repository at `/<repo-name>/`, or at `/` on a custom domain.

This is controlled with `BASE_URL`.

Vite uses it for asset URLs, React Router uses it as the router's `basename`, `finish-static-build.sh` uses it to place the pages, and the app reads it as `import.meta.env.BASE_URL`.

**Deployments** set `BASE_URL` from the Pages settings (`actions/configure-pages`'s `base_path`).

**Local and PR builds** (`npm run build:gh-pages`) default `BASE_URL` to `/footsteps/`. This is set in `package.json`.

`npm run dev`, `npm run build`, and `npm run preview` use `/`.

## Documentation

`npm run build:gh-pages` also builds the documentation site. VitePress renders `docs/` and TypeDoc's HTML from `docs/tsdoc/` is copied in, so the whole site is published at `<base>docs/` alongside the app. Dead links in `docs/` fail that build, so the documentation is checked before it deploys.
