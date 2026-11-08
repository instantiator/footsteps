# ADR 0010: Tracking players from behind

- Status: Accepted, pending a real-camera check
- Date: 2026-11-01

## Context

The game will run with the camera behind the player, a little above them and looking down, and the screen in front.
So the camera sees the player's back, not their face.

We also want players to pass in front of and behind things in the scene. For that, the game needs to know how far each
player is from the camera. With a camera looking down at the floor, nearer people stand lower in the picture, so the
height of their feet in the picture is a good guide to distance.

The question was whether foot tracking is steady enough for this, and what else could improve tracking.

**What we know, and don't.** Our one photo of people from behind found both people and all four hands, but none of
their feet. Their cut-out shapes reached the bottom of the picture. That is a single photo, at eye level. Nobody has
tested a real camera from behind yet, so the choices below are our best reading, not proof.

> `two-from-behind` in the vision bench: 2/2 people, 4/4 hands, 0/4 feet, silhouette reach 100% (ADR 0005 recorded 0/4
> feet for all four models). BodyPix's head points come from face pixels, so they may be missing from behind too.

## Decision

Depth comes from the bottom of the player's **silhouette** (their cut-out shape), not from their detected feet. We keep
the current vision model and add no hardware or clothing. We'll check it with a real camera, then revisit if needed.

| Option                                        | Verdict                                    |
| --------------------------------------------- | ------------------------------------------ |
| Bottom of the silhouette for depth            | **Selected**                               |
| Hold depth through jumps, ignore small jitter | **Selected**                               |
| Camera position, lighting and clothing        | **Recommended** (free)                     |
| Compare the models we already have            | **Recommended**                            |
| Compare against a picture of the empty room   | **Recommended next**, if cut-outs are poor |
| Coloured gloves, shoes and hats               | **Not recommended** for now                |
| Xbox 360 Kinect                               | **Not recommended** for now                |
| Other vision models                           | **Not recommended**                        |

## Options considered

### Bottom of the silhouette (selected)

The model can find a person's shape without recognising a foot, and that shape is what we draw. So its bottom edge
gives a depth even when no foot is found. Its weakness is anything that stretches the shape downwards, such as a dark
shadow the model takes for part of the person.

### Holding depth steady (selected)

A jump lifts the feet, which would look like walking away. So the game uses the lowest point from the last 0.7 seconds.
Stepping nearer shows at once, and stepping away shows after 0.7 seconds. Small changes are ignored, so a player
standing near an item's line doesn't flicker in front of and behind it. Both amounts can be changed in the settings.

### Camera position, lighting and clothing (recommended)

These cost nothing and help every model. Mount the camera high enough to see feet across the whole play area, light
the area evenly, avoid strong light behind or in front of the player, and wear clothes that contrast with the floor.

### Compare the models we already have (recommended)

The game can already switch between three models with a setting. MediaPipe has dedicated heel and toe points, but finds
fewer people in a group. A test from behind will show which suits this setup best.

### Compare against a picture of the empty room (recommended next)

Because the camera stays fixed, the game could take a picture of the empty room, then treat whatever differs as a
person. This could sharpen the cut-outs. Shadows on the floor and changing light are the risks. Try this if the
real-camera check shows poor cut-outs.

### Coloured gloves, shoes and hats (not recommended for now)

**Could it track accurately?** Partly. Brightly coloured shoes and hats should show up well to a camera above and
behind. Hands are harder, because a body hides hands held in front of it, and from behind that is often.

**Could it support the video overlay?** No. Markers give points, not a shape, so we'd still need a model for the
cut-out.

It would also need tuning to each room's lighting, could be confused by similar colours in the room, and every player
would need the kit. Revisit it if the real-camera check shows feet or hands are found too rarely. Coloured markers could
also tell players apart, which the current tracking can't do reliably.

> A colour tracker converts each frame to hue, saturation and brightness (HSV), keeps pixels in a colour range, and
> finds the centre of each blob. It's a small amount of code and needs no dependency, but it needs per-venue tuning.

### Xbox 360 Kinect, model 1414 (not recommended for now)

A Kinect measures real distance, which would give true depth rather than our estimate. But it is a large step in
complexity, and the part we most wanted is missing on a Mac.

| Question                    | Answer                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hands, feet and head?       | Not on a Mac. We found no working way to get body tracking. Only depth pictures are available, so a vision model would still be needed.                                  |
| Works with this M1 MacBook? | Possibly, but unproven. There are reports of it working on M1, described as flaky, and one report of crashes. Nothing on Tahoe.                                          |
| Works in a browser?         | Not directly. A browser doesn't see it as a camera, so a separate program would have to pass its pictures to the page.                                                   |
| Works from behind?          | Depth should work from any side. Body tracking from behind is untested. It's also expected to need indoor light and a range of about 0.8–4 m (from memory, not checked). |
| Drivers and software        | The open-source `libfreenect` driver, plus a small program we'd write. Model 1414 is also expected to need its USB and power adapter (from memory).                      |

This needs code outside the browser, so it has its own prompt:
[998.00.00](../prompts/998.00.00.prompt%20-%20kinect%20depth%20bridge.md).

> Skeleton tracking came from Microsoft's Kinect SDK (Windows only) or NITE, which Apple's purchase of PrimeSense took
> off the market. On a Mac, `libfreenect` gives only depth and colour frames.

### Other vision models (not recommended)

YOLO26's licence would require publishing the game's source, RTMPose would add a second machine-learning system, and
Sapiens is far too slow for a browser. [ADR 0005](0005-vision-models.md) has the details.

## Consequences

- Depth works without a recognised foot, and adds no hardware or kit for players.
- **Depth is an estimate.** It assumes a camera looking down and a flat floor, and someone whose legs are hidden will
  seem further away than they are.
- Only items in a challenge's foreground can be sorted. A display's overview and stage foregrounds stay behind the
  player, because they must stay beneath challenge backgrounds.
- An item can't be sorted if something around it in the template creates its own layer, for example with a CSS
  `transform` or `opacity`.
- **Each player now has their own canvas**, which costs some speed in groups but none for one player. Median frame
  rates, before then after: 1 person 15.2 to 15.1, 2–3 people 13.1 to 12.1, 4 or more 7.0 to 6.2 (from the vision bench,
  on photos).
- Foot and head interactions and jump detection still use the model's points, so they may work poorly from behind.
- The real-camera check is still owed ([manual testing](../testing/manual-testing.md)). Its results could change these
  verdicts, and the depth settings are estimates until then.

## Detail

> `groundOf` (`src/components/camera/PlayerDepth.ts`) finds the row with 99% of the silhouette above it, which ignores
> stray pixels. A `DepthFollower` per player takes the maximum over `cameraDepthWindowMs`, and changes only past
> `cameraDepthDeadband`. A held player keeps their depth. The work is skipped when a display has no `data-depth` items.
>
> Players and the challenge foreground share one stacking context, `.depthStack`. Items and canvases get
> `z-index = depth - 1000`, always negative, so anything with no depth stays in front of them. `PlayerCanvases` keeps one
> canvas per player. `?debug=true` draws each player's depth as a green line on their canvas.
>
> Tests: `tests/Depth.test.ts`, `tests/PlayerCanvases.test.ts` and `tests/browser/depth.spec.ts`.

## Sources

- libfreenect: <https://github.com/OpenKinect/libfreenect>
- Kinect on an M1 Mac, depth only: <https://bookstack.hku.nl/books/3d-depth-cameras-motion-tracking/page/macos-kinect-touchdesigner-mac-m1/export/html>
- FreenectTD, tested with model 1414: <https://derivative.ca/community-post/asset/freenecttd-kinect-op-mac/71868>
- A report of flakiness and crashes on M-series Macs: <https://www.patreon.com/posts/156328430>
- NITE and skeleton tracking on a Mac: <https://discourse.libcinder.org/t/skeleton-tracking/1405>
- Colour tracking with a webcam: <https://www.ece.lsu.edu/ipl/SampleStudentProjects/ProjectKenny/Final%20Report.pdf>
