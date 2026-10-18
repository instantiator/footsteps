# ADR 0001: Replace vite-react-ssg with React Router framework mode

- Status: Accepted
- Date: 2026-10-18

## Context

The game is a static site on GitHub Pages. At build time, each page (the landing page, plus `/game/<id>` and `/game/<id>/json` for every game in `public/game-repository.json`) is rendered to an HTML file. This is called prerendering, or static site generation (SSG). The browser then loads React and takes over from that HTML.

Until now this was done by vite-react-ssg, a third-party build plugin. Its latest release (0.9.2) only works with React Router v6. React Router v6 has two published security advisories (an open redirect through `<Link>`/`useNavigate`, and an injection issue during hydration) that are only fixed from v7.18. So keeping vite-react-ssg means keeping a vulnerable router, with no date for a compatible release. See [the upstream position](#upstream-position).

React Router itself now has a "framework mode" that prerenders static pages, so the plugin's job is covered by the router we already use.

## Options considered

1. **Keep vite-react-ssg on React Router v6 and record the risk.** This needs no code changes. The advisories stay open until the plugin's maintainer ships React Router 7+ support, and the vite 8 upgrade depends on the same plugin.
2. **Use React Router framework mode with prerendering.** This fixes the advisories and removes a dependency, using the router's own supported way to build a static site. It changes the app's entry point, route definitions and build commands.
3. **Switch to a different SSG tool or router.** This is more change than option 2, for no extra benefit.

## Decision

Option 2. We use React Router (v8) in framework mode with server rendering turned off and every known route prerendered at build time. This keeps the site fully static on GitHub Pages and keeps the existing URLs. — see [how it maps](#how-the-pieces-map)

## Consequences

- The router advisories are fixed, and vite-react-ssg is gone, so one fewer dependency has to keep pace with React Router and vite.
- Routes are declared in a route config file rather than an array passed to a plugin. Each page is a "route module" (a file whose default export is the page component).
- The HTML shell (head tags, fonts, root element) moves from `index.html` into a root route component.
- Build and dev commands become `react-router build` and `react-router dev`, and the static output goes to `dist/client`, so the deploy workflow points there.
- Harder: the app now follows React Router's framework conventions, so future router major versions may bring framework-level migration steps, not just API changes.
- New games still need no route changes. The prerender list is read from `public/game-repository.json`, as before.

## Detail

### Upstream position

vite-react-ssg issue #73 ("Upgrade react-router-dom from v6 to v7") was closed in August 2025. The maintainer said they still plan to support React Router 7's library mode, but will recommend framework mode for SSG. As of 0.9.2 (July 2026), its peer dependency is still `react-router-dom ^6.14.1`.

### How the pieces map

| Before (vite-react-ssg)                                   | After (React Router framework mode)                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/main.tsx` calls `ViteReactSSG({ routes, basename })` | `react-router.config.ts`: `ssr: false`, `prerender()` lists routes, `basename` from `BASE_URL` |
| `src/routes.tsx` `RouteObject[]` with `lazy` imports      | `src/routes.ts` route config (`index`, `route("game/:id", …)`, `route("game/:id/json", …)`)    |
| `index.html` head and `#root`                             | `src/root.tsx` `Layout` with `<Meta>`, `<Links>`, `<Scripts>`, and the font links              |
| `ssgOptions.includedRoutes` in `vite.config.ts`           | `prerender` in `react-router.config.ts`, reading game ids from `public/game-repository.json`   |
| `@vitejs/plugin-react`                                    | `reactRouter()` vite plugin (skipped under vitest, which handles JSX itself)                   |
| `react-router-dom` imports                                | `react-router` imports                                                                         |
