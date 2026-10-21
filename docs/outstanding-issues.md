# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## Accepted risk: sprintf-js DoS advisory via @tensorflow/tfjs

`@tensorflow/tfjs@4.22.0` (latest) depends on `argparse@1` → `sprintf-js@1.0.3`, which [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) covers. Every sprintf-js release (≤1.1.3) is affected, so no override can fix it, and npm's suggested "fix" is a downgrade to tfjs 2.1.0. argparse is only used by tfjs's CLI `bin`, and the browser bundle doesn't include it (`grep` of `dist/` finds no sprintf/argparse code). Moderate severity.

**Act when:** `@tensorflow/tfjs` publishes a release that drops `argparse@1`, or a patched `sprintf-js` is published. Check with `npm audit`.

## TypeScript 7 upgrade blocked by typescript-eslint

TypeScript 7.0.2 is the latest release, but typescript-eslint 8.71.2 (latest) accepts `typescript >=4.8.4 <6.1.0`, so the project is on TypeScript 6.0.3.

**Act when:** `npm view typescript-eslint peerDependencies.typescript` accepts 7.x. Then bump `typescript` and run `dev-qual/scripts/check.sh` with a clean cache (`rm -rf node_modules/.tmp`).

## No captions for game audio

`GameDisplayMediaData` has no field for captions, so `GameAudioComponent` can't render a `<track>`. The jsx-a11y `media-has-caption` finding is disabled with that reason. The camera preview's `<video>` is exempt for good: it's a silent live feed of the player.

**Act when:** a game ships audio containing speech. Add an optional `captionsResource` (WebVTT) to `GameDisplayMediaData` and render it as a `<track kind="captions">`.

## Camera segmentation loop fix is untested on a real camera

Bug #16 in [`docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md`](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md) was fixed in `CharacterCanvas`: the segmentation loop is cancelled on cleanup, and the webcam tracks are left to `CharacterCamera`. jsdom has no camera, WebGL or TensorFlow, so no automated test covers it.

**Act when:** a game with `modules.camera.enabled: true` is next run, at the latest during the camera-mode work (prompt 000.02.00). With `?debug=true`, check that the silhouette keeps tracking after toggling debug or changing the camera layout, and that the browser console shows no errors about a disposed model.

## No strict script-src Content-Security-Policy

Game repositories may be remote, and templates are compiled by Handlebars (which uses `new Function`) and inserted as HTML. `src/root.tsx` sets a CSP meta with `object-src 'none'; base-uri 'self'; form-action 'none'`, and DOMPurify strips script from template output. A `script-src` policy would also block injected script outright. But React Router's prerendered pages carry inline scripts that would need per-build hashes, and Handlebars needs `'unsafe-eval'`.

**Act when:** the app loads game repositories from authors who aren't trusted, or gains logins or cookies. Then generate `script-src` hashes in `finish-static-build.sh` (or move to precompiled templates and drop `'unsafe-eval'`), or render games in a sandboxed iframe.

## Validator does not read template contents

`validate-game.sh` and `validate-repository.sh` check that a template file exists and can load, but not the `{{resources.name}}` references inside it, which Handlebars resolves at render time. Static scanning would miss dynamic lookups such as `lookup` and `{{resources.[name]}}`, so it could not be exhaustive.

**Act when:** a template's resource reference is found missing only at runtime, or templates gain a stricter, scan-friendly format.

## Data validation needs the network for `url` resources

The validation scripts request each `url` resource (currently the game's Google Fonts stylesheet). `--skip-urls` avoids that, but pre-push and CI run without it, so an offline push or a third-party outage fails the gate.

**Act when:** the gate blocks a push or CI run only because a third-party host is unreachable. Then report network failures as warnings, or check URLs in a dedicated CI step instead of inside `npm test`.

## `local` resources in a third-party repository cannot be verified

A repository checked out from someone else may use `local` paths, which mean "on the viewer's site". The validator resolves them against `--site-root` and cannot know whether that repository's host serves them.

**Act when:** remote repositories become first-class content. Then validate `local` targets against the site that will host the repository, rather than against this checkout.

## No fullscreen on iPhone Safari

The HUD's fullscreen toggle (`src/components/core/FullscreenHook.ts`) uses the Fullscreen API's `requestFullscreen` on the document element. iPhone Safari has no element fullscreen (`document.fullscreenEnabled` is false), so the button only logs a console warning there.

**Act when:** a game is expected to run fullscreen on an iPhone. Then hide the button when `document.fullscreenEnabled` is false, and consider a CSS-only "fill the viewport" layout as the fallback.

## Landing tile grid sizes chosen without a device check

The grid uses `repeat(auto-fill, minmax(14rem, 1fr))` with square tiles, which gives about five per row on a 1280px monitor and one or two on a phone, as the prompt asks. That has been verified in the browser at desktop and narrow widths, not on physical phones.

**Act when:** the landing page is reviewed on a phone and shows more than two tiles per row, or on a desktop monitor and shows more than six. Then adjust the `minmax` size in `src/components/landing/LocalListing.tsx`.

## Documentation site runs on a VitePress pre-release

`docs/` is rendered by `vitepress@2.0.0-alpha.20`. VitePress 1.6.4 is the latest stable release, but it pins Vite 5, whose bundled esbuild carries two dev-server advisories ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)), which failed the dependency audit. The 2.0 line uses the project's Vite 8, so `npm audit` reports only the accepted sprintf-js advisory. Its config and default theme match 1.x, but it may change between pre-releases.

**Act when:** VitePress 2.0 is released stable. Then bump `vitepress`, run `dev-qual/scripts/check.sh --comprehensive` and `npm run build:gh-pages`, and remove this entry.
