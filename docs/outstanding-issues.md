# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## TypeScript 7 upgrade blocked by typescript-eslint

TypeScript 7.0.2 is the latest release, but typescript-eslint 8.71.2 (latest) accepts `typescript >=4.8.4 <6.1.0`, so the project is on TypeScript 6.0.3.

**Act when:** `npm view typescript-eslint peerDependencies.typescript` accepts 7.x. Then bump `typescript` and run `dev-qual/scripts/check.sh` with a clean cache (`rm -rf node_modules/.tmp`).

## No captions for game audio

`GameDisplayMediaData` has no field for captions, so `GameAudioComponent` can't render a `<track>`. The jsx-a11y `media-has-caption` finding is disabled with that reason. The camera preview's `<video>` is exempt for good: it's a silent live feed of the player.

**Act when:** a game ships audio containing speech. Add an optional `captionsResource` (WebVTT) to `GameDisplayMediaData` and render it as a `<track kind="captions">`.

## Camera mode is not proven on a physical camera

The Playwright suite runs the real TensorFlow pipeline, but against a fake canvas stream. It does
not prove that a real webcam works, that a real player is segmented accurately, or that the camera
permission and preview behave the same in every browser. The manual script in
[`docs/testing/manual-testing.md`](testing/manual-testing.md) covers those checks.

**Act when:** a game ships with camera mode on, or a tester reports the silhouette or interactions
behaving differently from the fake-camera suite. Run the manual script on at least two machines, with
different lighting and a second player, and record the results.

## Browser suite depends on the TensorFlow model download

The first browser run downloads the BodyPix ResNet50 weights (about 90 MB) from the network, and
headless Chromium needs hardware WebGL to segment fast enough; the config enables Metal on macOS.
The suite is therefore local only, and a slow or offline network makes it fail before any assertion.

**Act when:** the suite should run in CI, or a first run fails only because the model download timed
out. Then cache or vendor the model files for the tests, and add a CI job with a GPU or a longer
timeout.

## Players are identified by segmentation index

`usePlayerInteractions` keys monitors by the player's index in the segmentation. If two players
cross and the model swaps their order, the held and jump state can follow the index rather than the
person, so one player may inherit the other's state.

**Act when:** a game supports two players interacting at the same time, or a tester sees an
interaction fire for the wrong player after they cross. Then track players across frames (for
example by matching feet positions) and key the monitors by that identity.

## Camera interactions are only available on overview displays

`getInteractionTargets` returns the current overview display's targets, and an empty map while a
stage is open. Stage and challenge displays can set their own camera mode, but their elements cannot
yet be interaction targets.

**Act when:** a game needs an interaction inside a stage or challenge. Then extend
`getInteractionTargets` to the active stage and challenge displays, add their elements to the
target map, and cover the stage case in `tests/GameClickUtils.test.ts` and
`tests/GameLayersLayout.test.tsx`.

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

## No fallback when the Screen Wake Lock API is unavailable

`useWakeLock` uses the Screen Wake Lock API only. Safari on iOS, and some older browsers, do not
support it, so the device may sleep during a game there. The hook logs a warning and play continues.

**Act when:** a game is expected to run on a device that sleeps mid-game. Add a fallback such as a
looping muted video or an audio track, and cover it in `tests/WakeLock.test.ts`.

## Low-battery warning only in Chromium browsers

`BatteryWarning` uses the Battery Status API (`navigator.getBattery`), which Firefox and Safari do
not provide, so players there get no warning before the battery runs out.

**Act when:** a game is expected to run on Firefox or Safari unattended for long sessions. Then
consider a reminder to plug in on the landing page for every browser.

## Saved progress is discarded when a game's stage or challenge ids change

The stored projection is validated against the current game. If an author renames or removes a stage
or challenge, the saved value no longer matches and Continue disappears. This avoids applying
progress to a different structure, but authors cannot keep progress across content edits.

**Act when:** a game is updated while players have progress that should survive. Add a migration step
that maps old stage and challenge ids to new ones, or store stable ids separately from display names.

## Documentation site runs on a VitePress pre-release

`docs/` is rendered by `vitepress@2.0.0-alpha.20`. VitePress 1.6.4 is the latest stable release, but it pins Vite 5, whose bundled esbuild carries two dev-server advisories ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)), which failed the dependency audit. The 2.0 line uses the project's Vite 8, so `npm audit` reports nothing. Its config and default theme match 1.x, but it may change between pre-releases.

**Act when:** VitePress 2.0 is released stable. Then bump `vitepress`, run `dev-qual/scripts/check.sh --comprehensive` and `npm run build:gh-pages`, and remove this entry.
