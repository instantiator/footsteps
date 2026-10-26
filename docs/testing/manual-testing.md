# Manual testing: camera mode

A short script for checking camera mode with a real webcam. The automated suites cover the logic;
this covers what only a person in front of a camera can confirm.

## Before you start

- `npm install` and `npm run dev`.
- A webcam, and permission for the browser to use it.
- Camera mode enabled for `magic-trifle` in `public/game-repository.json`:

```json
"modules": {
  "camera": { "enabled": true, "preview": true }
}
```

Revert the module change when you have finished. The committed game leaves `modules.camera` off, but
one of its displays turns the camera on, so the landing page still requires camera permission.

## Camera smoke test

Open <http://localhost:5173/game/magic-trifle>.

- [ ] The landing page fills the viewport with the game's tile graphic and shows its title and
      description.
- [ ] The permissions panel lists Camera, with a Grant button, and New game is disabled.
- [ ] Click Grant and allow the camera. The panel shows a check mark, and New game becomes enabled.
- [ ] Click New game. The URL changes to `/game/magic-trifle/play`.
- [ ] A small preview appears in the top right, mirrored like a selfie camera.
- [ ] The player's silhouette replaces the room around them, as a black cut-out.
- [ ] Walking around moves the silhouette with you.
- [ ] The page shows no errors in the browser console.

Now add `?debug=true` to the URL and reload.

- [ ] Each player is tinted, with their head, hands and feet in their own colours, and a colour key
      appears below the preview.
- [ ] A readout over the silhouette shows the frame rate, inference time, and the people, hands and
      feet found. With one player standing full length in a lit room, it shows 1 person, 2 hands and
      2 feet, at 10 fps or more.
- [ ] Small markers show where the camera found each foot.
- [ ] The console still shows no errors.

## Landing, progress, and keep-awake

Turn camera mode off everywhere for this section: set `modules.camera.enabled` to `false` and set
every display's `camera.enabled` to `false`. The committed game has one display that turns the camera
on, so changing only the module is not enough.

- [ ] `/game/magic-trifle` says "No permissions needed." and New game is enabled.
- [ ] Complete a challenge, return to `/game/magic-trifle`, and Continue appears.
- [ ] Continue opens `/game/magic-trifle/play` at the saved stage.
- [ ] New game clears the saved progress: after it, Continue is gone on the next landing visit.
- [ ] Re-enable a camera display, clear the site's camera permission, and visit
      `/game/magic-trifle/play` directly: it returns to the landing page.
- [ ] While a game is open and incomplete, the device does not sleep or dim the screen. Completing
      the last stage releases the wake lock; check the browser console for wake-lock warnings if the
      device still sleeps.
- [ ] In Chrome, override the battery to 15% and discharging (DevTools → Sensors, or a stubbed
      `navigator.getBattery`): the low-battery banner shows on `/`, `/game/magic-trifle` and the
      play page, and goes when charging.

## Bug #16: the segmentation loop keeps running

Bug #16 was a segmentation loop that kept using a disposed model after its component changed. The
loop must survive a debug toggle, a resize, and closing a challenge.

Start with `?debug=true`. To change the flag without reloading the page, paste this into the browser
console (it changes the URL and tells React Router to re-read it):

```js
history.pushState({}, "", "?debug=false");
dispatchEvent(new PopStateEvent("popstate"));
```

- [ ] Toggling debug on and off (repeat the snippet, changing the URL) leaves the silhouette
      tracking.
- [ ] Resizing the window keeps the silhouette tracking, and the layers still line up.
- [ ] Opening a challenge and returning to the overview keeps the silhouette tracking, and no
      "disposed" or vision-model errors appear.

## Per-display on, off, and preview

Camera mode is resolved display by display: any active challenge that enables it wins; otherwise an
explicit challenge setting, then the stage's shared display, then the overview display, then the
game's `modules.camera` setting applies.

| Check                                               | How                                                                                              | Expected                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| The title screen uses the game default              | Load the game                                                                                    | Camera as configured in `modules.camera`              |
| A stage can turn the camera off                     | Add `"camera": { "enabled": false }` to `stages[].displays[0]` for `stage-1`                     | Entering stage 1 removes the preview and silhouette   |
| Returning reacquires the camera                     | Close the challenge from the stage above                                                         | Preview and silhouette return, with a fresh stream    |
| The preview can hide while the camera keeps working | Set `"preview": false` on the same display                                                       | The preview container is hidden, the silhouette moves |
| A challenge can override its stage                  | Add `"camera": { "enabled": true }` to one challenge display, and `false` to the stage's display | Entering that challenge turns the camera on           |
| A challenge that says nothing inherits its stage    | Remove the challenge's `camera` setting and enable the stage's display                           | Entering the challenge keeps the camera on            |

The preview is hidden with CSS rather than unmounted: the `<video>` is the segmentation source, so
the silhouette must keep working when the preview is off.

## Each camera interaction

Interactions are declared by display rules (see [rules and state](../game-data.md#rules-and-state)). For example,
to make stage 1 respond to a hand at half coverage, change the stage link's rule on the overview display:

```json
{
  "on": { "interact": ["hand"], "target": "#stages-link-stage-1", "threshold": 0.5 },
  "do": [{ "enterStage": "stage-1" }]
}
```

The threshold is the fraction of the body part that must be inside the element (0–1, default 1).
An interaction fires once when it starts, and re-arms when the body part leaves the element.

| Interaction | How to perform it                                            | Expected                                           |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------- |
| `click`     | Click the element, or focus it and press Enter or Space      | Enters the stage, as before                        |
| `hand`      | Put a hand over the element                                  | Enters the stage once, when the threshold is met   |
| `foot`      | Put a foot over the element                                  | Enters the stage once, when the threshold is met   |
| `head`      | Put your head over the element                               | Enters the stage once, when the threshold is met   |
| `body`      | Cover the element with any part of your body                 | Enters the stage once, when the threshold is met   |
| `any`       | Cover the element with any single body part                  | Enters the stage once, when the threshold is met   |
| `jump`      | Stand inside the element, jump up, and land or settle inside | Enters the stage once, when the sequence completes |

A jump must happen within 1.5 seconds: rise, fall, then come to rest with the feet still inside the
element. Moving outside during the sequence is allowed, but the feet must return to complete it.

Try each interaction at least twice: once with the default threshold, and once with a low threshold
such as `0.2`. Confirm that holding still fires only once, and that moving away and back fires again.

- [ ] Complete a stage while standing with a hand over the next stage's link. When the overview
      fades back in, the stage does not open until you move the hand away and back.

## The rules demo

`rules-demo` exercises display rules and state, and turns the camera on for its stages overview and both stages.
Play it once with the mouse and once with the camera (`?debug=true` shows where your hands and feet are found).

- [ ] **Toggle:** click the yellow switch on the stages overview, then touch it with a hand. It slides between two
      places each time, rather than jumping.
- [ ] **State is kept:** move the switch, open a stage, close it again: the switch is where you left it, and
      still is after a reload.
- [ ] **Balloons:** balloons fall one at a time, swaying. Click one, then pop one with a hand: it bursts where it
      is, the score goes up, and a new one appears at the top, in a different place and the next colour (red, green, yellow, blue, magenta, cyan, then red again). A balloon that reaches the bottom bursts there with
      no score. At 10 the stage completes.
- [ ] **Balloons start afresh:** close the balloons stage partway and open it again: the score is back to 0.
- [ ] **Lava:** step on a lava pool: the door disappears and the message says to go back. Step on Start: the
      door returns. Step on the door's base: the stage completes. The same works by walking the mouse over them.
- [ ] **Covering:** with the HUD over part of the game, a hand under the HUD's buttons does not count.

## Without a working camera

- [ ] Open another app that holds the camera (a video call), then New game or Continue into a camera
      display: the game shows without the preview or silhouette, the console warns once that the camera
      could not start, and clicking a stage link still enters the stage.
- [ ] With the camera free again, reload: camera mode works as before.

## Running the automated browser suite

The suite runs the real vision pipeline in Chromium against a fake webcam, so it needs no
physical camera. It is local only, and is not part of CI.

```bash
npx playwright install chromium  # once
scripts/run-browser-tests.sh
```

- Each run downloads the vision model (BodyPix MobileNetV1 by default), so it needs network access.
  On Apple Silicon the suite takes about 2–3 minutes.
- The config uses port `5180` and reuses a dev server already running there.
- On macOS the config enables Metal and WebGPU, because headless Chromium otherwise falls back to
  software WebGL and tracking becomes too slow to test.
- `E2E_STATIC=1 scripts/run-browser-tests.sh` runs the suite against the static build (`npm run build` and
  `npm run preview`) instead of the dev server. The rules demo specs need no vision model.
- A failure writes a trace under `test-results/`. Open it with
  `npx playwright show-trace test-results/<test>/trace.zip`.

What the suite proves:

| Test                                                | Proves                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page starts the game at `/play`             | The landing page and route split work in a real browser                                                                                                          |
| Shows the preview and runs the silhouette loop      | The fake camera reaches the preview, and segmentation draws frames                                                                                               |
| Debug changes the mask type                         | The loop survives the mask-type change with no model errors                                                                                                      |
| Preview off keeps the camera running                | Hiding the preview does not stop segmentation                                                                                                                    |
| Camera-off display stops, returning reacquires      | The track ends on the camera-off display, and a live stream returns                                                                                              |
| Switching the fake camera image changes the preview | The harness controls the image the app receives                                                                                                                  |
| Rules demo (`rules.spec.ts`)                        | The toggle, balloons and lava play by mouse; display state is kept, and resets on show; the mouse passes through empty foreground but not through drawn elements |

The suite does not prove that a physical camera works, that a real player's body is segmented
accurately, or that the model download succeeds on every network. Cover those with the manual
checks above.
