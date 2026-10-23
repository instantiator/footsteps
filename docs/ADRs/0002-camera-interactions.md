# ADR 0002: Camera interactions and per-display camera settings

- Status: Accepted
- Date: 2026-10-22

## Context

Camera mode was all-or-nothing: `GameData.modules.camera.enabled` switched it on for a whole game,
the webcam preview always showed, and the only way to act on a game element was a click. The camera
already found each person's feet, but nothing used them beyond a debug overlay.

Games need to turn the camera on or off for a title, a stage, or a challenge; to hide the preview
without stopping segmentation; and to let players interact with elements by moving their body. Any
new interaction model also has to keep clicks working, including for keyboard players, and keep
locked and completed stages inaccessible.

## Decision

1. **Camera settings resolve per display.** `modules.camera` sets the game default, and every
   display may declare `camera: { enabled?, preview? }`. For each setting, any active challenge that
   says `true` wins; otherwise any active challenge that says `false` wins; otherwise the stage's
   shared display, the overview display, the game module, and finally the default decide. Camera
   mode defaults off and the preview defaults on. The preview is always off while the camera is off.
2. **`clickIdToStageId` becomes a map of interaction targets.** Each value is
   `{ stage, interactions?, threshold? }`. `interactions` defaults to `["click"]`, so unchanged game
   data behaves exactly as before. A target can accept `click`, `hand`, `foot`, `head`, `body`,
   `any`, or `jump`. `threshold` is the fraction of the chosen body part that must be inside the
   element (0–1, default `1`).
3. **A monitor turns frames into events.** `CharacterCanvas` reports every player's mask and feet,
   with a timestamp, once per segmentation frame. `usePlayerInteractions` converts the visible
   targets' screen rectangles into mask space, keeps one `PlayerMonitor` per player, and passes each
   frame to it. The monitor counts mask pixels inside each target, applies the threshold, and emits
   an event only when an interaction starts. A jump is a short state machine over the feet's
   vertical speed: rise, fall, then rest inside the element within 1.5 seconds.
4. **Camera events use the same state changes as clicks.** `getNewGameStateForInteraction` applies an
   interaction through the existing click logic, after checking that the target accepts it. Locked
   and completed stages stay guarded, and the title screen remains click-only.

## Consequences

- Existing game JSON had to migrate from `{ "id": "stage-1" }` to `{ "stage": "stage-1" }`. The
  default interactions preserve click behaviour, so gameplay did not change.
- Camera mode and preview can be scoped to the display that needs them. Hiding the preview keeps the
  `<video>` mounted and segmentation running.
- Clicks remain the accessible route, and every camera interaction has a click-equivalent path
  through the same state helper.
- Camera interactions currently exist only on overview displays: `getInteractionTargets` returns no
  targets while a stage is open.
- Players are identified by their index in the segmentation. If two players swap order, their
  monitors (and jump state) can swap with them.
- The monitor adds per-frame work: one bounding-box lookup per target, plus a mask scan per target
  and player. That is small next to inference, but it grows with the number of targets.
- The real browser proof lives in a local-only Playwright suite, because the first run downloads the
  TensorFlow model and headless segmentation is slow without a GPU.

## Detail

### Why per-display, challenge-first

A challenge is the most specific thing on screen, so it should be able to override its stage and the
overview. "Any challenge `true` wins" lets one challenge that needs the camera keep it on when a
sibling challenge disables it; an explicit `false` only applies when no active challenge enables it.
This matches how the display selection already works: the active challenges are the most specific
rendered displays.

### Why a monitor, not DOM events

The browser does not tell us where a player is; the segmentation model does. Turning masks into
events in one place keeps the game code free of pixel maths, makes the threshold and jump rules
testable without a camera, and lets the same event apply to any element with an `id`.

The alternative — one callback per element, attached when the template renders — would spread the
mask maths across components and make edge-triggering and jump state hard to keep consistent.

### Coverage and mirroring

For each target, the monitor counts the mask pixels of the relevant body part inside the element's
rectangle and divides by that part's pixels in the whole frame. The interaction holds when at least
one pixel is inside and the fraction meets the threshold. `body` uses all opaque pixels, `any`
checks each body part separately, and the named parts use both left and right versions (hands, feet,
faces).

The silhouette canvas is mirrored with `scaleX(-1)`, so the element's screen rectangle is mirrored
about the canvas centre before it is scaled into mask pixels. Without that step, a player reaching
left would trigger an element on the right.

### Jump sequence

| Phase     | Moves to              | When                                                                 |
| --------- | --------------------- | -------------------------------------------------------------------- |
| `ready`   | `rising`              | Feet meet the threshold inside, and vertical speed is upward         |
| `rising`  | `falling`             | Feet meet the threshold inside, and vertical speed is downward       |
| `falling` | `ready`, emits `jump` | Feet meet the threshold inside, and vertical speed is close to still |
| any       | `ready`               | 1.5 seconds pass without completing the sequence                     |

Vertical speed comes from the feet's `percent.y` between frames, divided by elapsed seconds, in
frame-heights per second. More than `0.3` upward or downward counts as moving. Leaving the element
does not reset the sequence while the window is open, but the feet must return inside to complete
the falling and resting steps.
