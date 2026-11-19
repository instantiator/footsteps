# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## TypeScript 7 upgrade blocked by typescript-eslint

TypeScript 7.0.2 is the latest release, but typescript-eslint 8.71.2 (latest) accepts `typescript >=4.8.4 <6.1.0`, so the project is on TypeScript 6.0.3.

**Act when:** `npm view typescript-eslint peerDependencies.typescript` accepts 7.x. Then bump `typescript` and run `dev-qual/scripts/check.sh` with a clean cache (`rm -rf node_modules/.tmp`).

## Knip unused-code check is not set up

aislop 0.19 reports `knip/skipped` because Knip isn't installed; the notice is accepted in `.aislop/ci-baseline.json`. A trial `npx knip` run lists 11 unused files, 11 unused exports, 33 unused exported types, 4 unused and 2 unlisted dependencies, each needing a keep-or-delete decision.

**Act when:** the next clean-up pass, or when dead code is suspected. Add `knip` to devDependencies, resolve or configure its findings, then drop the `knip/skipped` entry from the baseline with `aislop baseline prune`.

## No captions for game audio

`GameSceneMediaData` has no field for captions, so `GameAudioComponent` can't render a `<track>`. The jsx-a11y `media-has-caption` finding is disabled with that reason. The camera preview's `<video>` is exempt for good: it's a silent live feed of the player.

**Act when:** a game ships audio containing speech. Add an optional `captionsResource` (WebVTT) to `GameSceneMediaData` and render it as a `<track kind="captions">`.

## Camera mode is not proven on a physical camera

The Playwright suite runs the real vision pipeline, but against a fake canvas stream and photos. It does
not prove that a real webcam works, that a real player is segmented accurately, or that the camera
permission and preview behave the same in every browser. The manual script in
[`docs/testing/manual-testing.md`](testing/manual-testing.md) covers those checks.

**Act when:** a game ships with camera mode on, or a tester reports the silhouette or interactions
behaving differently from the fake-camera suite. Run the manual script on at least two machines, with
different lighting and a second player, and record the results. Include the vision defaults chosen in
ADRs 0004 and 0005 (BodyPix MobileNetV1, frames 960 wide, 3 refinement steps, WebGPU, in a worker): check the debug readout shows 2 hands and 2 feet per
full-length player at 10 fps or more, and compare `?visionModel=movenet` in the same room. Play the rules demo by
camera too ([the rules demo](testing/manual-testing.md#the-rules-demo) checklist): its covering check and
selector-based targets are only tested with synthetic frames, and camera play of the demo only through its rules. Check
the camera feedback work too ([ADRs 0007](ADRs/0007-camera-flicker.md) and [0008](ADRs/0008-jump-detection.md)):

- standing still doesn't flicker, walking leaves no trail, and a player who walks out of the picture fades within
  about a second;
- the edges look soft rather than jagged;
- hops on the spot and between two elements fire `jump`, `jump-from` and `jump-onto` for a child and an adult;
- stepping back and forth fires nothing.

Tune the `VITE_JUMP_*` and `VITE_CAMERA_HOLD_MS` / `VITE_CAMERA_FADE_MS` defaults from what you see, as they are estimates.

Run [the floor and 2.5D scenes](testing/manual-testing.md#the-floor-and-25d-scenes) checklist too: the default
corners are calculated for an assumed camera, not measured, and whether a calibrated floor lines up, keeps feet green
at every edge and fits a small floor without cutting anything off can only be seen in a real room.

## Tracking from behind is not proven on a real camera

The game is built for a camera behind the player, but this has only been tested with photos, and only one is from
behind. It placed no feet, so head and foot interactions and jumps, which use the model's points, may fail from behind.
The depth settings are estimates, and `cameraFillGaps`'s stray copies are only reproduced with synthetic frames. Their
likely cause hasn't been confirmed on real footage.

**Act when:** before a game ships with a camera behind the player. Run [From behind](testing/manual-testing.md#from-behind)
and record the results in [ADR 0010](ADRs/0010-player-tracking-from-behind.md). If feet or heads are found in fewer than
about 9 frames in 10, compare the other models, then consider the options that ADR lists. Tune `cameraDepthWindowMs` and
`cameraDepthDeadband` from what you see.

## Only challenge foregrounds can be sorted by depth

Overview and stage foregrounds always stay behind the player, because they must stay beneath challenge backgrounds.

**Act when:** a game needs a player to pass behind something on an overview or a stage's shared scene. Sort those
layers with the players while no challenge is showing.

## The landing page may miss a new default camera

Browsers don't name a default camera, so a new first camera in their list stands in for one. They may not report a
change of default at all, and the list's order may not follow it, in which case the page keeps the old camera.

**Act when:** a tester reports the landing page not following a new default camera. Then reopen the camera on each
check and compare the device it gives.

## A jump can land a frame early onto an element nearer the camera

`jump-onto` fires on the first frame the feet have come back down far enough. When landing on an element lower on
the screen (nearer the camera), the feet may not have reached it yet on that frame.

**Act when:** players report `jump-onto` missing elements nearer the camera, or firing on the element just above
them. Then wait for the feet to settle (still for a frame, or level with the ground they left) before picking the
landing element, at the cost of a frame of delay.

## A quick step back and forth can look like a jump

Jumps are told from walking by the feet's movement alone. A quick step back then forward rises and falls like a
jump.

**Act when:** players report jumps they didn't make. Then also require the head to rise with the feet, for models
that place the head ([ADR 0008](ADRs/0008-jump-detection.md), option 3).

## Gap filling is off by default

`VITE_CAMERA_FILL_GAPS` fills parts of a player the model missed for one frame. It is off because it can smear fast
limbs, and it hasn't been seen on a real camera.

**Act when:** players report limbs (often legs) flickering while the rest of them is steady. Then try
`?cameraFillGaps=true` in the same room, and make it the default if limbs stop flickering without visible smears.

## Browser suite depends on downloading the vision models

The browser suite and the vision bench download their models from Google's storage (see "Camera model and
fonts load from third parties at play time"), and headless Chromium needs the GPU to track fast enough; the
config enables Metal and WebGPU on macOS. The suite is therefore local only, and a slow or offline network
makes it fail before any assertion.

**Act when:** the suite should run in CI, or a run fails only because a model download timed out. Then
vendor the model files and add a CI job with a GPU or a longer timeout.

## Groups of four or more slow BodyPix down

Each extra person adds a full-size mask for BodyPix to read back and process, so its time grows with the number of
people. With the 720p tuning (frames 960 wide, 3 refinement steps; ADR 0004), the vision bench runs one or two people
at 10–13 fps but groups of four to ten at 4.6–7.3 fps.

**Act when:** a game is meant for four or more players at once, or a real-camera session drops below 8 fps with
a group. Then bench input widths between 640 and 960 with `VISION_BENCH_QUERY="&visionInputWidth=800"`, or cap
`visionMaxPeople` at the game's player count, comparing the hands and feet found in the group photos.

## MoveNet key points with BodyPix silhouettes

MoveNet placed key points quickly and counted people well (28 fps in the bench), but its selfie-segmenter
silhouettes often missed people further from the camera. A hybrid that takes MoveNet's key points and
BodyPix's person-only masks might combine the two, at the cost of two models per frame.

**Act when:** BodyPix's frame rate or hand and foot placement isn't good enough in real-camera sessions.
Then add it as a fourth model behind `FootstepsVisionModelImplementation` and compare it in the bench.

## Other vision models to revisit

- **YOLO26** (pose and instance segmentation, with an official browser package) is AGPL-3.0. **Act when:**
  an AGPL release of the game, or an Ultralytics licence, is acceptable, and BodyPix misses players.
- **WebNN** (which could reach the Apple Neural Engine) is a Chrome origin trial only. **Act when:** WebNN
  ships in stable Chrome or Safari with a Core ML backend.

## Head box is approximate for MediaPipe and MoveNet

Those models give ears and eyes, not the head's outline, so the head's top and bottom come from typical
proportions (`PoseGeometry.ts`), not the mask.

**Act when:** a game uses `head` interactions with `mediapipe` or `movenet`, and they fire in the wrong place.
Then measure the head's extent from the mask above the shoulders.

## Player effects are unproven on a real camera

The automated browser tests use one photo at a time, so can't show two people crossing, a person really walking out of shot, or how a filter on a player's canvas feels. See [Player effects](testing/manual-testing.md#player-effects).

**Act when:** before a game ships that uses player effects. Run those checks; if crossing players swap often enough to spoil a game, or stuttering shows, revisit tracking by appearance, or the filter.

## A stranger can inherit a removed player's note

A new person appearing near where a removed player was lost inherits their removal, so someone walking through that place can drop out of play ([player tracking](player-tracking.md#limits)).

**Act when:** a tester hits this in play. Then limit how long a note lasts, or how close counts, by what they were doing.

## Near rules scan the mask each frame

Each near rule looks at the circle around its element, for each player, every frame. The bench shows no cost with one rule and one person.

**Act when:** the bench's `monitor-ms` is over 2 ms with near rules in a game. Then share the scan between rules, or do it at a lower resolution.

## A challenge's sibling counts for the camera check, across chunks

The load check that a scene's camera can be on counts another challenge in the same stage as turning it on if the stage shows several at once, even if they fall in different chunks, so aren't shown together. It can miss a mistake, but never rejects a working game.

**Act when:** a game hits this and is confused by a player effect silently doing nothing. Then work out which challenges share a chunk.

## Scenes can't share state

Each scene has its own state. A stage's shared scene and its challenges can't share a value, such as a score
that carries from one challenge to the next.

**Act when:** a game needs one value across scenes. Then add a shared scope (eg. per stage) to `sceneStates`,
and a way for expressions to read and `set` it.

## Covering is sampled at one point per body part

A camera interaction only counts where the element is on top, checked with one `elementFromPoint` per body part, at
the centre of where the part overlaps the element (`visibility` in `PlayerMonitor.ts`). A part that overlaps a mostly
covered element can miss the uncovered sliver, or hit it.

**Act when:** players report partly covered elements firing when they shouldn't, or not firing when they should.
Then sample a small grid across the overlap, and count the fraction on top against the threshold.

## Every rule's state change saves the progress

Scene state lives in `GameState`, so each `set` re-renders the game and writes saved progress to local storage.
That is fine at the rate rules fire (clicks, animation ends, timers of a second or so), but not for state that
changes many times a second.

**Act when:** a game uses `every` faster than about 200 ms, or a profile shows rule updates causing dropped frames.
Then debounce `saveGameState` in `GameStateProvider`, or move scene state into its own store with per-scene
subscriptions (the option set aside in [ADR 0006](ADRs/0006-display-rules-and-state.md)).

## The unmatched-selector check waits a fixed time

`useGameRules` warns about a rule selector that matches nothing in its scene 2 seconds after the scene is shown,
because templates load asynchronously.

**Act when:** the warning appears for a selector that does match (a slow template load), or a game needs the
warning sooner. Then have `GameSceneTemplateComponent` report when it has rendered, and check then.

## No strict script-src Content-Security-Policy

Game repositories may be remote, and templates are compiled by Handlebars (which uses `new Function`) and inserted as HTML. `src/root.tsx` sets a CSP meta with `object-src 'none'; base-uri 'self'; form-action 'none'`, and DOMPurify strips script from template output. A `script-src` policy would also block injected script outright. But React Router's prerendered pages carry inline scripts that would need per-build hashes, and Handlebars and filtrex (rule expressions; see [how filtrex works](filtrex.md)) need `'unsafe-eval'`.

**Act when:** the app loads game repositories from authors who aren't trusted, or gains logins or cookies. Then generate `script-src` hashes in `finish-static-build.sh` (or move to precompiled templates and an expression evaluator that walks the syntax tree, and drop `'unsafe-eval'`), or render games in a sandboxed iframe.

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

## No error boundary for game data that fails to render

`src/root.tsx` has no `ErrorBoundary`, so game data that throws while rendering (for example a
challenge with no scene) shows React Router's default error page. The validator catches most such
data before it ships.

**Act when:** the app is released to players, or game repositories come from authors whose data
isn't validated by this project. Then export an `ErrorBoundary` from `src/root.tsx` with a friendly
message and a link back to the landing page.

## Camera model and fonts load from third parties at play time

The vision models load from Google's storage when camera mode starts (BodyPix and MoveNet weights, MediaPipe's
`.task` and `.tflite` files; MoveNet from Kaggle), and the game's font from Google Fonts. MediaPipe's
wasm runtime is already bundled with the app. Offline, or during an outage, the camera shows no silhouette (the
model fails to load and play continues by clicks) and text falls back to another font. Camera
frames never leave the device.

**Act when:** a game must work offline or at a venue with poor connectivity, or a player reports a
missing silhouette with a working camera. Then vendor the model files and the font into `public/` and
load them from there.

## shellcheck version comes from the CI runner

CI uses the shellcheck that ships with `ubuntu-latest`, so its version changes when GitHub updates
the runner image, and may disagree with a local install. Every other tool is pinned in
`package-lock.json`, `.nvmrc` or `check.yaml`.

**Act when:** a shellcheck finding appears in CI but not locally (or the reverse). Then install a
pinned shellcheck release in `check.yaml`, as actionlint is.

## No volume setting for sounds

Rule sounds (`sound` actions) and the game's sound effects play at full volume; only the music fades. There is no
volume setting for a game, a sound, or the player.

**Act when:** players or testers ask to turn sounds down, or a game mixes loud and quiet sounds. Then add a
`volume` to `sound` actions and a player-facing volume control, applied in `playAudio`.

## Mouse-feet has no body for player effects

In `mouse-feet` the pointer's feet are drawn ([002.03.18](prompts/002.03.18.prompt%20-%20mouse-feet%20avatar.md)), but
they aren't a player in the registry, with a silhouette and states, which is what effects that act on players
(`player-fall`, `players`, `.player-*` targets) work on. So those effects can't run, and a scene that uses them must
be able to be in `camera` mode. The session's player count stays 0.

**Act when:** [996 (player avatars)](prompts/996.00.00.prompt%20-%20player%20avatars.md) is planned. Make the mouse-feet
avatar a registry player there, and let player effects act on it.

## The vision model sees the whole camera picture in 2.5D scenes

A 2.5D scene crops what the player sees to the floor, but the vision model is still given the whole picture. Cropping
its input too (with a margin, so feet at the front and arms past the sides aren't lost) was deferred, unbuilt:

- With the default floor (8–92% across, down to 90%), a margin of a tenth of the picture's width already reaches every
  edge, so the model's crop would be the whole picture: no faster, and nobody shown larger.
- The vision bench's photos are 960 px wide, the model's input width, so showing a crop of them larger adds no detail.
  The bench can't show the gain that matters, people at the back being found more often.
- Masks and key points would have to be mapped back to the whole picture, which costs a copy per person per frame.

**Act when:** players calibrate floors narrower than about 60% of the picture's width, or the bench gets
back-of-room photos at 1280 px or more. Then crop `detectFrame`'s input in `CharacterCanvas.tsx` to the floor's
crop plus a margin, map the results back, and compare the bench's people, feet and inference time with and without it
([ADR 0005](ADRs/0005-vision-models.md)).

## A camera's "System default" floor stays when the default changes

Floors are saved per camera configuration chosen on the landing page (`cameraKeyOf` in `FloorCalibration.ts`), so
"System default" is one camera. If the system's default camera changes, its old floor is still used.

**Act when:** a player reports a misaligned floor after switching cameras, or the landing page starts saving the
camera a stream really uses. Key floors by the stream's resolved device id instead.

## Camera scenes in dialogs aren't tested

No game has a camera in a dialog scene. Camera interactions map elements through the camera canvas's rectangle on
screen (`maskRectForElement`), which a 2.5D crop only moves and enlarges, so dialogs should work as templates do.

**Act when:** a game puts a camera interaction in a dialog scene. Add a browser check that a hand on a dialog's
element fires in a 2.5D scene.

## Floor placement isn't proven on a real camera

The browser suite proves floor items are placed, scaled and sorted, and that positions reach templates, with a fake
camera and the default floor. It can't show that items appear under a real player's feet, that sorting and position
variables don't flicker or lag, or that thickness feels right. The checks are in [Floor-placed items, on a real
camera](testing/manual-testing.md#floor-placed-items-on-a-real-camera).

**Act when:** before either 2.5D game is played with the camera. Run the checks on both, and tune `positionCellSize`,
`positionUpdatesPerSecond` and `cameraDepthDeadband` if positions jitter or lag.

## Floor surfaces aren't proven on a real camera

The browser suite proves floor surfaces are drawn onto the floor and that a floor area only counts where it is drawn,
with the default floor and the mouse, and that both games fill wide and tall screens. It can't show that they line up
with a real, recalibrated floor, that the silhouette lines up on any screen shape, or that standing on a tile feels
right. The checks are in [Floor surfaces, on a real
camera](testing/manual-testing.md#floor-surfaces-on-a-real-camera).

**Act when:** before either 2.5D game is played with the camera. Run the checks on both.

## Large surface boxes are drawn at a smaller scale

The engine caps a box it sizes at 4096 pixels across or down (`MAX_BOX_PIXELS` in `FloorSurfacePlacement.ts`), and
draws a larger surface at a smaller scale, given by `--floor-unit`. The floor background always hits the cap, as it
reaches back to the horizon, so its texture is drawn at about a pixel a floor unit and magnified near the camera. The
browser rasterises it at screen resolution, so it looked sharp in testing, but a detailed texture could blur.

**Act when:** a floor background's texture looks blurred near the front of the screen. Then draw the floor background
in two parts, a near one at the floor's scale and a far one at a smaller scale.

## 2.5D challenges side by side share one scene box

In a 2.5D scene, each layer's grid of challenges is the scene box, so two challenges shown side by side each get half
of it, and their `backgroundStyle` only fills their half. Their surfaces still reach the screen's edges. Nanny's Magic
Trifle's stage 3 shows two dialogs this way, which is fine as they have no floor.

**Act when:** a game shows two 2.5D challenges side by side that each want their own floor or background across the
screen.

## Floor items inside a transformed wrapper are misplaced

Placement reads an item's layout position from `offsetLeft`/`offsetTop`, which ignore transforms, so a wrapper with its
own `transform` (or `translate`, `scale`) throws its floor items off. No game does this.

**Act when:** a game puts floor items inside a transformed wrapper. Measure the item through its wrapper instead, for
example by placing it relative to its offset parent's on-screen box.

## Floor placement checks every item every frame

`useFloorPlacement` visits every `[data-floor-y]` item and floor surface on each animation frame in a 2.5D scene,
reading its layout and writing only what changed. It is O(items), and the games have a few dozen at most.

**Act when:** profiling shows placement taking more than about 1 ms a frame, or a scene has more than about 50 floor
items. Then place on resize, scene change and template mutation instead.

## Spectators still cost inference

The model segments the whole frame, so spectators cost as much to find as players; the loop only skips filling their
gaps and drawing them when hidden. Cropping the model's input to the floor would cut inference, but would lose
spectators, and with them their numbers and `resetOnReturn`.

**Act when:** inference on a real camera stays over about 50 ms a frame with spectators in shot, or a game wants a
room full of watchers. Then crop to the floor plus a band around it, and keep notes for those who leave the crop.

## Spectator margin and hold aren't proven on a real camera

`spectatorMargin` (5 floor units), `spectatorHoldMs` (1000 ms) and the 25-unit return distance were chosen without a
real room. Positions near the floor's edges are the least reliable, as the camera sees feet there at a shallow angle.

**Act when:** testing 2.5D scenes with a real camera. If players at an edge become spectators, raise the margin or the
hold; if walking round the pits doesn't reset "Cross the floor", lower the return distance (`RETURN_DISTANCE`).

## Jump and duck's thresholds aren't proven on a real camera

Jump and duck counts a hit as `body-enter` on a snowball (threshold 0.1) or `head-enter` on a bat (0.3), with the
snowballs at 82% of the scene's height and the bats at 22%. These are first guesses from the photos the browser suite
uses; it plays the game by mouse.

**Act when:** the first real-camera session. Note whether jumps clear the snowballs and ducks clear the bats (see
[Landing, progress, and keep-awake](testing/manual-testing.md#landing-progress-and-keep-awake)), and tune the
thresholds, the lanes' heights and the obstacles' sizes.

## Overview and stage dialogs sit behind players

A dialog or scroll draws its image and text together in its scene's foreground (prompt 002.03.10). For a challenge
that puts it in front of every player, but an overview's or stage's foreground is still beneath the camera silhouette.
No game has one.

**Act when:** a game puts a dialog or scroll in an overview or stage scene with the camera on. Then raise that
layer above the depth stack while it shows a dialog, or give dialogs a layer of their own above it.

## Camera players can't use dialogs

Dialogs and scrolls are for the mouse: their pages turn with buttons, and some ask for typed answers.

**Act when:** prompt [994 (virtual pointer mode)](prompts/994.00.00.prompt%20-%20virtual%20pointer%20mode.md) is
planned.

## Sample pictures aren't checked against the engine

The [sample elements](tutorials/sample-elements.md) are pictures taken in the scene renderer
(`tests/browser/sample-screenshots.spec.ts`), which only runs with `CAPTURE_SAMPLES=1`. Nothing notices when the
engine starts drawing a surface differently, so the pictures can go stale. The samples' HTML is checked: the
validator finds nothing wrong with any of them, and the docs quote them exactly.

**Act when:** `FloorSurfaces.ts`, `FloorSurfacePlacement.ts` or `FloorPlacement.ts` change how something is drawn, or
a sample changes. Then run `CAPTURE_SAMPLES=1 scripts/run-browser-tests.sh sample-screenshots` and look at the
pictures.

## The scene renderer shows how a scene looks, not how it plays

The [scene renderer](dev-overview.md#scene-renderer) takes a scene's HTML only, so rules, state and effects can't be
tried in it. It uses the floor saved for the chosen camera, or the default floor if there is none, so a calibrated
browser shows a different floor from the docs' pictures.

**Act when:** game authors ask to try rules in it, or are confused by a floor that differs from the pictures. Then
add a box for the component's JSON (its `rules` and `initialState`), or a "default floor" switch.

## A stopped `player-static` doesn't end its action

A named or grouped effect ends as it first finishes or is cut short on one of its elements or players. Stopping an indefinite `player-static` fades it out without telling the action, so a series waiting on it waits until its scene ends. The first player to finish also ends an effect on several players, as they start together and last as long.

**Act when:** a game puts an indefinite `player-static` in a series and stops it, or plays a player effect whose players finish at different times. Then report the static's stop as an end, and count each chosen player's end.

## A reward's end is capped at 2.5 s

partycles doesn't always resolve a burst's promise (it pauses while the page is hidden, and in headless Chromium it never resolved), so a named or grouped `reward` ends at `REWARD_END_MS` (2500 ms, `src/components/core/Game.tsx`) if its burst hasn't finished first.

**Act when:** a game waits on a reward whose burst clearly lasts longer or shorter than 2.5 s. Then tune `REWARD_END_MS`, or end on partycles' own completion once it reports it reliably.

## Dialogs and scrolls don't hit-test a still pointer

Template scenes with `mouse-enter` or `mouse-exit` rules hit-test the resting pointer each frame, so elements moving under it enter and leave it. Dialog and scroll scenes don't, and rely on the browser's events.

**Act when:** a dialog or scroll has moving targets with mouse rules. Then pass `watchPointer` through `GameSceneDialogComponent` and `GameSceneScrollComponent` as `GameSceneComponent` does for templates.

## Raised events carry no data

`raise` passes the raising rule's `event` but no values of its own; shared values go through state.

**Act when:** a game needs a raised event to carry a value its listeners can't read from state (eg. from another scene's state). Then add `data` expressions to `raise`, worked out as it fires, as `event.data`.

## Scenes that spawn skip the unmatched-selector warning

A copy's classes can depend on Handlebars branches its template hasn't rendered yet (Jump and duck's `.jd-bat`), so a scene with a `spawn` skips the "matches nothing" check for its targets, checking only each `spawn` and `into`. A typo in such a scene's targets goes unwarned.

**Act when:** a typo in a spawning scene's target goes unnoticed. Then check its targets against every branch of its templates' markup.

## The setup planner is not checked against a real room

The [setup planner](camera-mode.md#planning-the-space) is tested against its own geometry, and against the default
floor's derivation, but nobody has yet set a camera up from its recommendation and calibrated the result. Its
assumptions (a 10% edge inset, 0.1 m headroom, the floor's size limits, a 35° tilt limit) are reasoned, not measured.

**Act when:** someone sets up from the planner. Then calibrate, walk the floor's corners, and compare the calibrated
corners with where the planner said the floor's edges would fall in the picture. Tune the assumptions' defaults if
feet or heads leave the picture, or if the floor could have been larger.

## The setup planner forgets its values

The planner's values reset whenever the page is reloaded.

**Act when:** a user asks for their values to be kept. Then save them in `localStorage`, as the camera choice is.

## The setup planner's screen view shows the whole picture

The planner's screen view shows the camera's whole picture, unmirrored, as a 2D scene does. A 2.5D scene crops it to
the floor's width and mirroring flips it, so the view is only a guide to what a 2.5D game shows.

**Act when:** someone is misled by the difference. Then crop the view to the scene box (`FloorGeometry.ts`) for a
2.5D game, and add a mirror setting.

## The MacBook Pro's field of view isn't known

Apple publishes no field of view for the MacBook Pro 13-inch (M1, 2020) FaceTime HD camera, so its row in
[known webcams](webcams.md) says "Not published", and choosing it on `/setup` leaves the field of view as it was.

**Act when:** it has been measured, as [known webcams](webcams.md#measuring-a-field-of-view) describes. Then add it to
`src/components/camera/Webcams.ts` with `fovSource: "measured"`.

## The LifeCam HD-3000's SD field of view is an estimate

The ≈58° for the LifeCam HD-3000 at 640×480 assumes the camera takes a 4:3 picture from the middle of its 16:9 sensor,
keeping its full height. If it scales or crops differently, the figure is wrong, and so is `/setup`'s recommendation
for it.

**Act when:** the SD configuration is used to plan a room, or a calibrated SD floor doesn't match `/setup`'s plan.
Measure it, and record it as `measured`.

## Every Mac's FaceTime camera matches the MacBook Pro's rows

The MacBook Pro's `labelPattern` matches any camera labelled "FaceTime HD Camera", which other Macs use too, so they
are offered its configuration.

**Act when:** another Mac's camera is added to `Webcams.ts`, or one is found to give a different picture. Then tell
them apart, by the label's USB id if the browser gives one.

## A `cameraWidth` query parameter doesn't follow the calibration key

With no configuration chosen, the game opens the camera at `cameraWidth` × `cameraHeight` from the app config,
including the URL's query parameters, but the calibration key uses the size from `.env` alone (`sizeOf` in
`CameraChoice.ts`), which has no access to the URL. A `?cameraWidth=` override can then play at one size with the
floor calibrated for another.

**Act when:** someone uses those query parameters with a 2.5D game. Then have `sizeOf` take the app config the game
uses, or drop the query override for the camera size.

## The landing preview's size assumes a 16:9 picture

The landing page's camera preview is limited in width so that a 16:9 picture fits the height left beside the panels
(`.game-camera-preview` in `GameLanding.css`). A 4:3 camera, or a taller panel, can still push the camera panel past
the bar, when the column scrolls.

**Act when:** the column scrolls on a common screen size. Then size the preview from the space left, measured in
script, or with a container query.
