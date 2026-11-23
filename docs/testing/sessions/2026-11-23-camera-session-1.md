# Camera session 1: detection (2026-11-23)

Stage 6 of `docs/prompts/003.00.03.plan - behaviour and scale fixes.partial.md`. It checks, on a real camera, that a
player on the floor stays a player, and gathers evidence for tuning and for exclusion zones (D7).

## Set-up

- **Branch:** `003.00.05-debug-recordings` (003.00.03 plus the recorder), with `?debug=true`.
- **Camera:** Microsoft LifeCam HD-3000, 1280 × 720, not mirrored. It sits behind the floor, so the player faces away
  from it, towards the TV.
- **Floor:** calibrated as a rectangle, with its width and depth entered in metres.
- **Model:** BodyPix MobileNetV1 with the default settings (see each recording's `config`), at about 14 frames a
  second and 80 ms a frame.

## Recordings

The zips are in the tester's `~/Downloads`, not in git (7–13 MB each). Times below are seconds into each video. The
depth settings are `cameraDepthWindowMs` and `cameraDepthDeadband`, set by URL query.

| #   | File (`footsteps-recording-2026-11-23T…`) | Scene              | What was done                                   | Depth settings |
| --- | ----------------------------------------- | ------------------ | ----------------------------------------------- | -------------- |
| R1  | `21-12-43-561Z.zip`                       | Walk around        | Walk in, stand still for 10 s, walk out         | 700 ms, 2      |
| R2  | `21-28-44-334Z.zip`                       | Walk around        | Each corner in turn, 3 s at each                | 700 ms, 2      |
| R3  | `21-58-52-351Z.zip`                       | Walk around        | Front to back and back again, twice             | 700 ms, 2      |
| R4  | `22-03-46-830Z.zip`                       | Walk around        | Front to back once, then two jumps mid-floor    | 300 ms, 1      |
| R5  | `22-06-21-744Z.zip`                       | Walk around        | Waving: at the back (by the TV), then mid-floor | 300 ms, 1      |
| R6  | `22-10-36-075Z.zip`                       | Avoid the pits     | Step over a pit, then into one                  | 300 ms, 1      |
| R7  | `22-11-32-408Z.zip`                       | Bridge across lava | Cross the bridge to the door                    | 300 ms, 1      |

## Findings

- **F1. Players stay players.** On the floor, the player never turned into a spectator. They did only when really
  off the floor: walking in and out, past the front edge (R2, 20 s) and past the right edge (R2, 33 s). Standing
  still, hands and feet moved 1–5 px (of 960) over 10 s (R1). All four corners were reachable (R2).
- **F2. No phantom people.** No frame of any recording has a second person: the TV, furniture and plants were never
  detected. Stray patches (magenta in debug mode) showed now and then on the right, small and rare.
- **F3. The depth lags about 0.6 s** behind the feet with the defaults (R3, fitted from the feet's height in the
  picture against the depth used), and moves in steps of 5–15 units, from the deadband. With 300 ms and 1 (R4) the lag
  is about 0.1 s and the steps 3–5 units. One jump leaked into the depth for a single frame (R4, 12.2 s:
  54.6 → 40.9), and the model lost the player for 2 frames at the top of each jump.
- **F4. Empty detections become stand-in players.** BodyPix sometimes reports a person with no pixels at all, so no
  outline and no key points. The tracker can't place them, makes a new player for each, and holds the real one.
  Usually it lasts 1–2 frames (R2, front-left corner, four times; R7 twice), but with arms raised at the back it
  cascaded into 33 stand-ins over 4 s (R5, 10.5–14.8 s).
- **F5. The hand points are confused from behind.** Hands are the centres of BodyPix's "left hand" and "right hand"
  pixels, and with the player facing away those labels break down: both points sit on one hand while the other has
  none (R5, 21.7 s and 43.6 s), a label jumps to the other hand for a frame, or covers both and lands between them.
  At the bridge's door the right hand was missing for 8 s (R7, 22–30 s). The busy background isn't the main cause:
  it happens over the plain sideboard too.
- **F6. A falling player looked like a dropped one** (R6, 21.2–22.7 s). Stepping into a pit made the player leave and
  then come back, as designed, but the recording's `role` shows only `held` and then nothing, as it doesn't record
  the player's game state.
- **F7. The framing is tight.** The head touches the top of the picture mid-floor, and raised hands leave it at the
  back (R5, 10–16 s). Tilting the camera down or moving it back would fix it.
- **F8. The debug depth line is drawn level** across the picture. The depth itself comes from the floor's corners,
  but the line doesn't follow the floor's slope (the back edge drops from 54% to 58% of the picture, left to right).
- **F9. Doors are hard to open, and the hazard is slow.** The bridge's door needs a foot on it (`#door`, threshold
  0.05) for 1 s unbroken, and is 4 units deep on the floor at y 12. The player stood at about (87–93, 5–15) for 8 s
  (R7, 22–30 s) without opening it. The near door in Walk around only flickered on, and its hazard was slow to notice
  the player. F3, F4 and the small targets all work against them.
- **The games otherwise felt reasonable.** Stepping over and into a pit registered, and the bridge's pieces fell
  reliably.

## Actions

| Finding | Action                                                                             | Where                  |
| ------- | ---------------------------------------------------------------------------------- | ---------------------- |
| F2      | Exclusion zones (D7) aren't needed                                                 | Dropped from 003.00.03 |
| F3      | Make 300 ms and 1 the defaults, with a test that a jump barely moves the depth     | 003.00.03              |
| F4      | Ignore detections with no pixels                                                   | 003.00.03              |
| F5      | Find the hands so their labels don't depend on which way the player faces          | 003.00.03              |
| F6      | Record each player's game state, and the scene, in recordings                      | 003.00.05              |
| F7      | Re-aim the camera before session 2                                                 | Set-up                 |
| F8      | Draw the line between the floor's edges at the player's depth                      | 003.00.03              |
| F9      | Re-check in session 2, after the fixes above and stage 9's door sizes and triggers | 003.00.03 stage 9, 11  |

## Gaps

- Chrome may block a second download from the same page; allow it from the address bar's download icon.
