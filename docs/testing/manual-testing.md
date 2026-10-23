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

Revert the change when you have finished: the committed game ships with the camera off.

## Camera smoke test

Open <http://localhost:5173/game/magic-trifle> and allow the camera.

- [ ] A small preview appears in the top right, mirrored like a selfie camera.
- [ ] The player's silhouette replaces the room around them, as a black cut-out.
- [ ] Walking around moves the silhouette with you.
- [ ] The page shows no errors in the browser console.

Now add `?debug=true` to the URL and reload.

- [ ] The silhouette is tinted by body part, and a colour key appears below the preview.
- [ ] Small markers show where the camera found each foot.
- [ ] The console still shows no errors.

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
      "disposed" or TensorFlow errors appear.

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

Interactions are declared on the overview display's `clickIdToStageId` entries. For example, to
make stage 1 respond to a hand at half coverage:

```json
"stages-link-stage-1": {
  "stage": "stage-1",
  "interactions": ["hand"],
  "threshold": 0.5
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

## Running the automated browser suite

The suite runs the real TensorFlow pipeline in Chromium against a fake webcam, so it needs no
physical camera. It is local only, and is not part of CI.

```bash
npx playwright install chromium  # once
scripts/run-browser-tests.sh
```

- The first run downloads the BodyPix ResNet50 weights (about 90 MB), so it is slower and needs
  network access. On Apple Silicon the suite takes about 3–4 minutes; the first test carries most of
  the model-download cost.
- The config uses port `5180` and reuses a dev server already running there.
- On macOS the config enables Metal, because headless Chromium otherwise falls back to software
  WebGL and segmentation becomes too slow to test.
- A failure writes a trace under `test-results/`. Open it with
  `npx playwright show-trace test-results/<test>/trace.zip`.

What the suite proves:

| Test                                                | Proves                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Shows the preview and runs the silhouette loop      | The fake camera reaches the preview, and segmentation draws frames  |
| Debug changes the mask type                         | The loop survives the mask-type change with no model errors         |
| Preview off keeps the camera running                | Hiding the preview does not stop segmentation                       |
| Camera-off display stops, returning reacquires      | The track ends on the camera-off display, and a live stream returns |
| Switching the fake camera image changes the preview | The harness controls the image the app receives                     |

The suite does not prove that a physical camera works, that a real player's body is segmented
accurately, or that the model download succeeds on every network. Cover those with the manual
checks above.
