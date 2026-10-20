# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## dev-qual's installer writes a double blank line into AGENTS.md

`dev-qual/adapters/opencode/install.sh` starts the skills block with `echo ''`, and `merge_block` adds a blank line after the start marker. The result fails markdownlint MD012. We fixed AGENTS.md by hand.

Fixed upstream in [instantiator/dev-qual#7](https://github.com/instantiator/dev-qual/pull/7), along with the pre-commit hook failing on staged deletions. Until it merges, the `dev-qual` checkout here is on its branch `fix/precommit-deletions-and-skills-blank-line`.

**Act when:** dev-qual#7 merges. Run `dev-qual/scripts/upgrade.sh`, re-check AGENTS.md with `dev-qual/scripts/check.sh --fast`, commit the new submodule pointer, and delete this entry.

## Accepted risk: sprintf-js DoS advisory via @tensorflow/tfjs

`@tensorflow/tfjs@4.22.0` (latest) depends on `argparse@1` → `sprintf-js@1.0.3`, which [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) covers. Every sprintf-js release (≤1.1.3) is affected, so no override can fix it, and npm's suggested "fix" is a downgrade to tfjs 2.1.0. argparse is only used by tfjs's CLI `bin`, and the browser bundle doesn't include it (`grep` of `dist/` finds no sprintf/argparse code). Moderate severity.

**Act when:** `@tensorflow/tfjs` publishes a release that drops `argparse@1`, or a patched `sprintf-js` is published. Check with `npm audit`.

## TypeScript 7 upgrade blocked by typescript-eslint

TypeScript 7.0.2 is the latest release, but typescript-eslint 8.71.2 (latest) accepts `typescript >=4.8.4 <6.1.0`, so the project is on TypeScript 6.0.3.

**Act when:** `npm view typescript-eslint peerDependencies.typescript` accepts 7.x. Then bump `typescript` and run `dev-qual/scripts/check.sh` with a clean cache (`rm -rf node_modules/.tmp`).

## No captions for game audio

`GameDisplayMediaData` has no field for captions, so `GameAudioComponent` can't render a `<track>`. The jsx-a11y `media-has-caption` finding is disabled with that reason. The camera preview's `<video>` is exempt for good: it's a silent live feed of the player.

**Act when:** a game ships audio containing speech. Add an optional `captionsResource` (WebVTT) to `GameDisplayMediaData` and render it as a `<track kind="captions">`.

## Unused props on GameDisplayTemplateComponent

`stageId`, `challengeId`, `solution`, and `onAnswer` on `GameDisplayTemplateComponent` (`src/components/core/display/GameDisplayTemplateComponent.tsx`) are accepted but never read. They were marked `TODO (currently unused)` with no condition.

**Act when:** a template display needs to check answers itself (for example, an input embedded in template HTML). Then wire them up. Otherwise, if no such display is planned by the next feature touching template displays, delete them and stop passing them from `GameDisplayComponent` and `GameDisplayDialogComponent`.

Prompt 000.01.00 touched template displays (the Handlebars migration) without planning such a display, so this condition is met. The deletion is waiting on the user's go-ahead.

## Camera segmentation loop fix is untested on a real camera

Bug #16 in [`docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md`](prompts/000.00.02.feedback%20-%20fixes%20from%20identified%20bugs%20and%20tests.md) was fixed in `CharacterCanvas`: the segmentation loop is cancelled on cleanup, and the webcam tracks are left to `CharacterCamera`. jsdom has no camera, WebGL or TensorFlow, so no automated test covers it.

**Act when:** a game with `modules.camera.enabled: true` is next run, at the latest during the camera-mode work (prompt 000.02.00). With `?debug=true`, check that the silhouette keeps tracking after toggling debug or changing the camera layout, and that the browser console shows no errors about a disposed model.

## No strict script-src Content-Security-Policy

Game repositories may be remote, and templates are compiled by Handlebars (which uses `new Function`) and inserted as HTML. `src/root.tsx` sets a CSP meta with `object-src 'none'; base-uri 'self'; form-action 'none'`, and DOMPurify strips script from template output. A `script-src` policy would also block injected script outright. But React Router's prerendered pages carry inline scripts that would need per-build hashes, and Handlebars needs `'unsafe-eval'`.

**Act when:** the app loads game repositories from authors who aren't trusted, or gains logins or cookies. Then generate `script-src` hashes in `finish-static-build.sh` (or move to precompiled templates and drop `'unsafe-eval'`), or render games in a sandboxed iframe.

## aislop flags the sanitised template HTML

`npx aislop scan` reports `security/dangerously-set-innerhtml` in `src/components/core/display/GameDisplayTemplateComponent.tsx`, so `dev-qual/scripts/check.sh --comprehensive` fails its aislop stage. The rule matches any `dangerouslySetInnerHTML`. The HTML is sanitised with `DOMPurify.sanitize` on the same line, and `tests/GameDisplayTemplateComponent.test.tsx` checks that scripts, event handlers and forms are stripped.

**Act when:** the user decides how to record the false positive: accept it into `.aislop/baseline.json`, or add an `aislop-ignore` comment with the reason. Then delete this entry.
