# ADR 0007: Camera flicker

- Status: Accepted
- Date: 2026-10-27

## Context

The camera layer draws each player cut out of the video by the silhouette (the mask) the vision model finds. When the
model misses a player for a frame, which happens with motion blur, odd poses or poor light, the silhouette vanishes
and the player flickers on and off. Sometimes only part of them goes missing, such as their legs.

A fix must not leave a trail of old silhouette behind a player who is moving. It must not slow the camera loop, which
runs at 4–6 fps on the target machine. And a silhouette that is only being shown must not trigger game interactions.

The tracker already matches each person in a frame to someone in the frame before, by the centre of their silhouette,
so that their id stays the same ([ADR 0004](0004-vision-optimisations.md)). That matching tells a player who has
dropped out apart from one who has moved: someone who moved is matched where they are now, and someone who dropped
out isn't matched at all.

## Options considered

1. **Hold unmatched people.** If someone the tracker was following isn't matched in a frame, keep drawing their last
   silhouette for a set time, then fade it out. Someone who moved is matched, so they leave nothing behind. This
   doesn't help when only part of a player is missed.
2. **Hold, plus a shifted union.** As option 1, plus each matched player's silhouette is drawn combined with their
   silhouette from the frame before, moved by as far as they moved. This fills parts missed for one frame. It costs a
   pass over each player's mask per frame, and can smear limbs that move fast.
3. **Hold and fade each pixel.** The first suggestion: every pixel that was part of a player stays for a while, then
   fades. It is simple, but a moving player trails a fading copy of themselves, which is the problem to avoid.
4. **Ease each pixel's opacity.** Each pixel's opacity moves part of the way towards the new mask every frame. It
   softens flicker and edges together, but leaves short trails on fast moves, and a player missed altogether still
   fades out within about 200 ms.

## Decision

Option 1 is the default. Option 2 is available as a setting, off by default, after a user decision.

- A player who goes unmatched is held for `VITE_CAMERA_HOLD_MS` (400 ms), then fades over `VITE_CAMERA_FADE_MS`
  (300 ms). At 5 fps, a dropout usually lasts one or two frames (200–400 ms). A longer hold, such as the 1 s first
  suggested, would leave a visible ghost for that long whenever someone walks out of the picture.
- A held player is drawn only. They never trigger an interaction, and their interaction state, including a jump in
  progress, waits for them to be found again (see [ADR 0008](0008-jump-detection.md)).
- `VITE_CAMERA_FILL_GAPS` turns on the shifted union. The filled silhouette is used for drawing only.

## Consequences

- No flicker for short dropouts, and no trails, because only people the tracker has lost are held.
- A player who walks out of the picture leaves a ghost for 0.7 s, fading for the last 0.3 s.
- Holding needs the tracker, so it does nothing when `VITE_VISION_SMOOTHING` is off.
- Partial dropouts still flicker unless gap filling is on. If it is on, fast limbs may smear for a frame.
- Tracks are now kept for at least the hold plus the fade, so a player who comes back within that time keeps their id.

See [how it works](#detail).

## Detail

### Holding

`PersonTracker.update` (`src/vision/Tracking.ts`) returns the frame's people, followed by each unmatched track's last
person, marked `held: { opacity }`. The opacity is 1 during the hold, then falls linearly to 0 over the fade. The
track expires after `max(500 ms, hold + fade)`. `silhouettePixels` (`src/components/camera/DrawPeople.ts`) draws each
person's pixels at `255 × opacity`, and where people overlap, the more opaque one wins. `usePlayerInteractions` keeps
a held player's monitor without updating it.

### Gap filling

With `cameraFillGaps`, each matched person gets `filled`: their mask combined with their previous raw mask, moved by
how far they moved (`fillFromPrevious`). Only the frame before is used, so a part that has really gone is gone a frame
later. The movement is the mean move of the key points (hands, feet, head) the model placed in both frames. The
silhouette's centre is used only if there are none. The centre can't be relied on, because it jumps when the model
misses a part, which is exactly when the fill is needed. Measured cost with one player: tracking goes from 1.1 to
2.0 ms per frame, with no change in fps.

### Testing

`tests/Tracking.test.ts` covers holding, fading, re-finding with the same id, moving with no ghost, and filling.
`tests/browser/camera.spec.ts` shows the fake camera an empty room for 250 ms. With holding on, the silhouette never
disappears. With holding off, it does, which shows the test can detect flicker.
