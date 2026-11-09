# Camera mode

Camera mode makes the player the game's character. A body-segmentation model cuts them out of the
webcam picture and layers their silhouette into the game's scenes, so they move through the artwork
as they move in front of the camera.

It is optional. A game can switch it on for the whole game, and any scene can override it. It is built for a
camera behind and a little above the player, with the screen in front, and also works with one facing them.

## Switching it on

Camera mode is the `camera` [avatar mode](game-data.md#scene-and-avatar-modes). For a whole game, set it in the
game's modules:

```json
"modules": {
  "avatar": { "mode": "camera", "fallback": "mouse", "preview": true }
}
```

| `avatar`                                  | Camera mode | Starting the game                                                     |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `{ "mode": "camera", "fallback": "..." }` | on          | The landing page offers the camera, but the game can start without it |
| `{ "mode": "camera" }`                    | on          | The game can't start until the camera permission is granted           |
| `{ "mode": "mouse" }` or `"mouse-feet"`   | off         | The camera isn't mentioned, unless another scene uses it              |

`preview` is optional and defaults to `true`. Set it to `false` to run the camera without showing the
small webcam preview.

Any scene (overview, stage `shared`, challenge or reset scene) can override the mode or the preview:

```json
"avatar": { "mode": "mouse" }
```

A scene that sets `mode` takes its `fallback` with it, rather than inheriting a broader one. `preview` inherits on
its own. They resolve most specific first:

1. The strongest mode any active challenge sets (`camera`, then `mouse-feet`, then `mouse`) wins. For the preview,
   any active challenge turning it on wins, then any turning it off.
2. Otherwise, the open stage's `shared` scene decides.
3. Otherwise, the overview scene decides.
4. Otherwise, the game's `modules.avatar` decides.
5. Otherwise, the mode is `mouse` and the preview is on.

The preview is always off unless the mode is `camera`. The code is `resolveAvatarMode` in
`src/components/core/logic/AvatarModeUtils.ts`.

## Mouse-feet

`mouse-feet` plays the camera's foot and jump rules with a pointer, so a scene built for walking and jumping works
without a camera, as a stand-in while designing, or as a camera mode's `fallback`. The pointer is player 1's feet:

- **Moving** onto an element fires `foot-enter` and `any-enter` (after the rule's `holdMs`), and moving off it fires
  `foot-exit` and `any-exit`. The feet are a point, so `threshold` doesn't apply. An element drawn over another
  covers it, unless the rule sets `includeCovered`.
- **A drag** from A to B is a jump that takes off from whatever is under A and lands on whatever is under B. Taking
  off leaves everything, and landing fires `jump-from` for A, `jump-onto` for B, and `jump` for an element under both
  (and for a `jump` rule with no target), then enters B. The browser's click at the end of a drag is dropped.
- **A press and release** that moves no more than 8 pixels (`DRAG_PX`) is still a `click`.
- Leaving the game viewport leaves everything. As with the camera, what is already under the feet when a scene starts
  or resets must be left and entered again.

Hand, head, body and near interactions never fire in `mouse-feet`, and nor do effects that act on players. Mouse
interactions (`click`, `mouse-enter`, `mouse-exit`) work as usual. The code is `MouseFeet` and `useMouseFeet` in
`src/components/core/layout/MouseFeetHook.ts`. The rules demo's stone hop stage uses it: the player drags between three stones over lava, each stone falling behind them.

## Permission

A game's landing page scans the game data, reset scenes included. If anything uses the camera, it asks the browser
for the permission and shows a Grant button until it is granted. If anything requires the camera, New game and
Continue stay disabled until then. See [Playing a game](game-play.md#permissions) for the full flow.

A direct visit to `/game/:id/play` repeats the check for a required camera, and returns to the landing page when the
permission is anything but granted. A grant made on the landing page in the same tab counts, even
when the browser cannot report it. If the camera still fails to start in play (for example because
another app is using it, or an optional camera was refused), the game carries on in the scene's `fallback` mode,
or by clicks if it has none.

## Choosing a camera

Once the permission is granted, the landing page offers a dropdown of the cameras the browser lists, with a mark on
the current choice, a "Mirror picture" checkbox, and a live preview. Browsers only name the cameras after a grant, so
none of this shows before one. The choice is saved in `localStorage`, and only the browser ever sees it.

- **System default** is the first choice, and the starting one. It follows the system: the landing page checks when
  the cameras change and when the page regains focus. Browsers don't name a default camera, so a new first camera in
  the list counts as a new default.
- **A chosen camera** stays chosen. If it is unplugged, the landing page goes back to the system default.
- **In play**, the game reads the choice once. It doesn't follow any changes: to change camera, return to the landing
  page. If the chosen camera has gone by then, the game uses the system default.

**Mirroring** is off by default, for a camera behind the player: they see themselves from behind, and step right to
move right. Turn it on for a camera facing the player, so the picture behaves like a mirror.

## The floor and 2.5D scenes

A [2.5D scene](game-data.md#scene-and-avatar-modes) is fitted to the floor the player can walk around on, so their
feet stay in view all over it. The player marks the floor once per camera, and every game shares it, because it
describes the room rather than a game.

### Calibrating the floor

For a game with 2.5D scenes, the landing page's camera preview outlines the chosen camera's floor and says whether it
has been saved. **Calibrate the floor** opens `/game/:id/calibrate`, which shows the camera picture with the floor
over it and steps on screen:

1. Drag each blue corner to a corner of the space you can walk around in. The floor can be any convex shape. A drag
   that would fold it stops at the limit. With the keyboard, Tab moves between the corners, and the arrow keys move
   the focused one (Shift moves it further).
2. Walk to each corner. Your feet should stay green: each foot is green on the floor and red off it, and the head and
   hands are marked too.
3. Press **Save** when it fits.

Calibration expects one person. While more are in view, it warns, the feet stop turning green or red, and Save is
disabled, though everyone is still marked. **Reset to the default area** puts the corners back to the defaults
until you save. **Forget all saved areas** clears every camera's floor after asking.

Corners are saved in `localStorage` per camera (the camera chosen on the landing page, so "System default" is one
camera), as fractions of the camera's own, unmirrored picture. Changing the mirror setting doesn't change them.

**When it's required.** A game with 2.5D scenes can't be started or continued with a granted camera until that
camera's floor is saved. A direct link to `/game/:id/play` goes back to the landing page too. A game without a camera,
or a player who hasn't granted it and plays by mouse, needs no floor. A 2.5D scene without a camera uses the default
floor on a 4:3 picture.

### The default floor

Before calibration, the corners are:

| Corners | Left | Right | From top |
| ------- | ---- | ----- | -------- |
| Front   | 8%   | 92%   | 90%      |
| Back    | 25%  | 75%   | 55%      |

They are calculated, not measured, for a 4:3 webcam with a 42° vertical field of view, 2 m high and tilted down 22°.
A row of the picture at fraction _y_ from the top looks down at `22° + atan((y − 0.5) / f)`, where
`f = 0.5 / tan 21°` in picture heights:

| Row from top | Distance on the ground | Width the row covers | Floor width |
| ------------ | ---------------------- | -------------------- | ----------- |
| 90% (front)  | 2.5 m                  | 3.1 m                | 84%: 2.6 m  |
| 55% (back)   | 4.5 m                  | 5.0 m                | 50%: 2.5 m  |
| 33%          | 7.6 m                  | 8.0 m                | a third     |

So the default floor is a rectangle about 2.6 m wide and 2 m deep, from 2.5 m to 4.5 m away, with a whole body in
view at the back. The front is inset, because tracking is weakest at the picture's edges. A camera set up differently
needs calibrating: a back edge at a third of the height would be 7.6 m away.

### Fitting the view to the floor

A 2.5D scene crops the camera picture, not the scene: to the floor's width (its bounding box, as the front edge can
slant), from the top of the picture down to the floor's lowest point. The game view takes the crop's shape, with side
bars around it, so the floor spans the view's width, its lowest point sits on the bottom edge, and players at the back
keep their heads in view. Scenes laid out in `cqw` and `cqh` reflow to the new shape. A change between a 2D and a
2.5D scene reshapes the view as turning the camera on does. 2D scenes show the whole picture.

The default floor on a 4:3 camera gives a view of about 1.24:1, a little squarer than the camera's. All the
conversions between the camera picture, the screen and the floor (the floor's perspective transform, the crop, and
screen-to-mask rectangles) are in `src/components/camera/FloorGeometry.ts`, and nothing else does this maths beyond
`FloorSurfaces.ts`, which builds the floor surfaces on it.
Interactions still map elements through the camera canvas's rectangle on screen, which the crop only moves and
enlarges, so they work unchanged.

## What the player sees

- **Their own silhouette.** The player is cut out of the webcam picture and shown in the game. They are not a drawn
  character: everything that is not them is removed. It is flipped if the player chose to mirror the picture.
- **A small preview** in the top-right corner, flipped the same way, so they can line themselves up.
  It can be hidden with `preview: false`.
- **The game's artwork** behind them, and a challenge's foreground in front of them, or around them if its items are
  [on the floor](#sorting-players-among-floor-items) of a 2.5D scene.
- **The HUD** in the top-right: "Close challenge", "To title", and the fullscreen button.

An ordinary scene change fades the old scene out over 1s, swaps, then fades the new one in over
1s. When camera mode turns on or off, the game view instead eases between the container's shape and
the camera's over 2s; if the scene changes too, it fades out over the final second of the reshape
and back in over 1s. With `prefers-reduced-motion: reduce`, every change is immediate.

The game waits for the webcam's shape before drawing the scene layers, so the silhouette and the
artwork line up. If the player refuses the camera permission, the layers stay hidden and the error
is logged in the browser console.

## How the view is layered

The game is a stack of layers. A larger `zIndex` paints later, so it covers the smaller ones.
`GameLayersLayout` builds the stack and `GameLayerWrappers` makes each layer.

Without the camera, the stack fills the game container. With the camera, it is fitted to the
camera's aspect ratio and centred, so the whole game is inside what the camera can see. A 2.5D scene fits it to the
[floor's crop](#fitting-the-view-to-the-floor) of the camera instead. The
container's background shows in the space around it. The game view is a size container, so game
templates can use `cqw` and `cqh` to follow it; `vw` and `vh` still follow the browser window. See the
[coordinate system](special-effects.md#coordinate-system).

The scene and camera layers sit inside one `.gameScene` wrapper, which fades as a whole; the HUD
sits outside it. For a camera change, or a change between 2D and 2.5D, `#game-viewport` animates its `aspect-ratio` with a 2s CSS
keyframe between the current shape and the camera's or container's shape, keeping the old scene
visible until the swap.

| `zIndex` | Layer                 | What it holds                                          |
| -------- | --------------------- | ------------------------------------------------------ |
| 1        | overview background   | the title or stages artwork, behind everything         |
| 2        | overview foreground   | its clickable parts, still behind the player           |
| 3        | stage background      | the open stage's shared artwork                        |
| 4        | stage foreground      | its clickable parts, still behind the player           |
| 5        | challenge backgrounds | the active challenges, side by side                    |
| 6        | depth stack           | the players and challenge foregrounds, sorted together |
| 7        | webcam preview        | the small video (`CharacterCamera`)                    |
| 9        | debug overlay         | the floor and body-part markers; only when debugging   |
| 10       | HUD                   | the application's buttons (`HeadsUpDisplay`)           |

Backgrounds sit behind the player, so they seem to stand inside the scene. A challenge's foreground
sits in front, which lets a game put a doorway over them, for example, unless an item is on the floor of a 2.5D scene.

## Player positions

Every player has a position, worked out each frame from their **ground point**: the bottom of their silhouette, and
the middle of its lowest pixels across. It uses the silhouette rather than the feet because models often can't find
feet from behind. [ADR 0010](ADRs/0010-player-tracking-from-behind.md) explains the choice and the alternatives.

- **In a 2.5D scene**, the ground point goes through the inverse of the floor's homography to **floor coordinates**:
  x from 0 at the floor's left edge (as seen on screen, so mirroring is taken care of) to 100 at its right, and y from
  0 at the back to 100 at the front. Someone standing off the floor gets values outside 0–100.
- **In a 2D scene**, the position is the ground point as a percentage of the scene, x from the left and y from the top.
- **With `mouse-feet`**, the pointer is player 1, and its position goes through the same mapping.

The position keeps the lowest ground point of the last `cameraDepthWindowMs`, so a jump doesn't look like walking away:
stepping nearer shows at once, and stepping away shows after that time. It only moves across while the player is on
the ground, so it holds where they took off from through a jump. Moves smaller than `cameraDepthDeadband` are ignored,
so a player standing still doesn't flicker.

The engine uses each frame's position to sort players among [floor items](game-data.md#floor-placed-items) and to
check items' thickness. Rules and templates get a coarser copy as `game.players.N.x` and `.y` (see [player
tracking](player-tracking.md#where-players-stand)), so templates don't re-render every frame.

### Sorting players among floor items

In a 2.5D scene, a player passes in front of and behind the challenge foreground's floor-placed items: each is sorted
by its floor y, and each player by theirs. Items that aren't floor-placed stay in front of every player, like a HUD.
2D scenes don't sort players at all.

- **Only challenge foregrounds are sorted.** Overview and stage foregrounds stay behind the players, because they
  must stay beneath challenge backgrounds. Their floor items are still placed and scaled.
- **Don't wrap floor items in a layer of their own.** If something in the template around an item creates a CSS
  stacking context (for example with `transform`, `opacity` below 1, or `isolation`), the item can't be sorted with
  the players. A `transform` on the item itself is fine.
- **It assumes a camera looking down at a flat floor.** Someone whose legs are hidden will seem further away than they
  are.

### Floor surfaces and the horizon

A 2.5D scene can draw [floor surfaces](game-data.md#floor-surfaces) in the floor's perspective: tiles, walls,
backgrounds, the ground and the horizon. Each is the floor's homography carried on past its edges (walls are raised
from it by the same scaling as floor items), so they move with the calibration. The horizon is where the floor's
parallel edges meet: the image of the floor's line at infinity. With the default corners it is level, about 4% below
the viewport's top. `FloorSurfaces.ts` works out every surface's corners on screen.

### The back of the floor

The floor narrows towards the back, so a scene's back corners may be out of reach. Floor-placed items avoid this, as
every floor point is reachable. This was chosen over sliding players sideways by depth (people drift sideways when
walking forwards, and it amplifies jitter), and over warping the camera image to a rectangle (it distorts bodies, and
costs time every frame). Debug mode shades what is off the floor, and warns of any target of a foot or jump rule that
isn't floor-placed or a floor area, and that no player can stand on.

The layers ignore the mouse (`pointer-events: none`), including the silhouette, so clicks reach the
game's elements underneath. Each element's `id` says what a click or camera interaction does.

## How the silhouette is made

1. `CharacterCamera` asks for the chosen webcam (1280×720 by default) with `navigator.mediaDevices.getUserMedia`, puts
   the stream in a `<video>`, and shares the video and stream with the rest of the layout.
2. `CharacterCanvas` creates the configured vision model with `createVisionModel` (see
   [configuration](#configuration)), once while there is a stream. By default this is BodyPix MobileNetV1 on
   WebGPU, run in a web worker. Every model implements `FootstepsVisionModelImplementation` (`src/vision/`).
3. Once per new camera frame (`requestVideoFrameCallback`), the model returns a `VisionFrame`: for each person, a
   silhouette mask and key points for their hands, feet and head. As soon as it returns, it is given the next
   frame, and the frame it returned is reported and drawn while it works. A `PersonTracker` keeps each person's id
   stable between frames and smooths their key points. It also holds someone the model loses for a moment where
   they were, then fades them out, so the silhouette doesn't flicker ([ADR 0007](ADRs/0007-camera-flicker.md)).
4. For each player, `drawPeople` (`DrawPeople.ts`) draws the video onto their own canvas (`PlayerCanvases.ts`) and
   keeps only that player, with their edges blurred by `cameraFeatherPx`. `binary` keeps the players' own colours;
   `colored` tints each person in their own colour, for debugging. Each canvas sits in a wrapper of its own, laid over the others; the original canvas stays hidden, to measure against.
5. If the player chose to mirror the picture, the canvases are flipped with a CSS transform. The masks are always in
   the camera's own (unmirrored) orientation.
6. When the stream goes away, the model is disposed and the loop is cancelled. Starting a new stream loads a
   fresh model.

## Configuration

The vision model, camera and jump settings are app config, set in the `.env` files or for one visit in the URL
query: see [Configuration](configuration.md). For example, `?visionModel=mediapipe&visionWorker=false` tries
MediaPipe Pose on the main thread. [ADR 0004](ADRs/0004-vision-optimisations.md) and
[ADR 0005](ADRs/0005-vision-models.md) explain the choices and measurements.

## How interactions work

Camera interactions fire scene [rules](game-data.md#rules-and-state) whose trigger is an `interact`:

```json
{
  "on": { "interact": ["click", "hand-enter"], "target": "#stages-link-stage-1", "threshold": 0.5 },
  "do": [{ "enterStage": "stage-1" }]
}
```

The trigger names the elements (any CSS selector), which interactions it accepts, and how much of the body part
must be inside an element. `threshold` defaults to `1`. Any scene that is showing can have them, including a
stage's shared scene and its challenges.

| Interaction                                                    | Detected from                                       |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `click`                                                        | A mouse click, or Enter/Space on a focused element  |
| `mouse-enter`                                                  | The mouse moving onto the element (not the camera)  |
| `mouse-exit`                                                   | The mouse moving off the element (not the camera)   |
| `hand-enter`                                                   | Either hand                                         |
| `foot-enter`                                                   | Either foot                                         |
| `head-enter`                                                   | The head                                            |
| `body-enter`                                                   | The whole silhouette                                |
| `any-enter`                                                    | Any single body part, or the whole silhouette       |
| `hand-exit`, `foot-exit`, `head-exit`, `body-exit`, `any-exit` | The matching `-enter` no longer holding             |
| `jump`                                                         | A jump that takes off from and lands on the element |
| `jump-from`                                                    | A jump that takes off from the element              |
| `jump-onto`                                                    | A jump that lands on the element                    |

A **body part** is a region of the player's silhouette. A hand or foot is a disc around its key point, scaled to
the player's head; the head is the box its top, bottom and sides span; the body is the whole silhouette. A
**threshold** is the fraction of a body part that must be inside the element's rectangle: `inside pixels / total
pixels of that part`. It is clamped to 0–1. The default, `1`, needs the whole part inside; `0` only needs one
pixel. `hand-enter`, `foot-enter` and `any-enter` fire when any one of their parts meets the threshold.

Interactions are **edge-triggered**: one fires when the player has met the condition for
`visionStableFrames` frames in a row (2 by default, so a one-frame flicker doesn't count), not on every frame
they hold it. Moving away re-arms it, so a second approach fires again. A player who already
meets the condition when their monitor starts (when camera mode starts, after a scene change, or on
coming back into view) must move away and back first.

With `holdMs` on the trigger, an `-enter` fires only once the player has also held it that long; moving away
before then starts the wait again. An **`-exit`** fires when an `-enter` that fired stops holding for
`visionStableFrames` frames, or when the player who held it leaves the camera's view (once the tracker drops
them). Clearing the monitors for a transition doesn't fire exits.

### Jumps

A **jump** is measured by how far the lower foot moves, as a fraction of the player's height (from their feet to the
top of their head), so near and far players, children and adults, jump alike. Sideways motion is ignored. All three
jump interactions fire as the player lands, on the elements their feet were on when they took off and when they
landed.

1. The feet stand still (within `jumpStill`) for at least `jumpMinGroundedMs`.
2. They rise at least `jumpMinRise` above where they stood. That is the take-off.
3. They come back down at least `jumpMinDescent` of the rise, within `jumpMaxAirtimeMs` of leaving the ground. That
   is the landing. A frame where the model loses the feet in the air is skipped.
4. A rise still going after `jumpMaxRiseMs`, or a jump that doesn't land in time, is abandoned. Wherever the feet
   are then is the ground. This is how stepping back, which raises the feet in the image, is told from a jump.

The settings' defaults are listed under [Configuration](configuration.md#jumps).
[ADR 0008](ADRs/0008-jump-detection.md) explains the model and how the defaults were chosen.

Clicks remain the keyboard-accessible route. A camera interaction fires the same rule a click would, through
`useGameRules` (`src/components/core/GameRulesHook.ts`), so `enterStage` still ignores locked and completed stages.

An element only counts where it is the **topmost** thing under the body part, as a click would find it: an
element covered by another doesn't respond, unless the rule sets `"includeCovered": true`. The check is one
`document.elementFromPoint` per body part and element, at the centre of where the part overlaps the element, and
only once the threshold is met, so it stays cheap every frame. The silhouette, the camera preview and the debug
overlay take no pointer events, so they never count as covering.

While a scene or camera transition is running, clicks and camera interactions are ignored. The
scene is `inert`, the monitors are cleared, and the camera hook drops frames. The fresh monitors
ignore whatever holds on their first frame, so a held hand cannot fire as the new scene arrives.

### From frame to event

`CharacterCanvas` calls `onPlayersChange` once per frame with every player's mask, key points and feet,
and the frame's timestamp. Each frame, `usePlayerInteractions` runs every camera rule's selector inside its
scene's templates (found by `data-scene-scope`), so elements can appear, move and disappear between frames. It
builds a mask-space rectangle for each element, keeps one `PlayerMonitor` per player, and passes the monitors'
events to `useGameRules`. The rectangle conversion mirrors the x axis if the canvas is mirrored, and
`screenPointForMaskPoint` maps back for the covering check.

The monitors remember each element by a key: its `id`, or a key generated for an element without one (held in a
`WeakMap`, so it goes with the element). An element without an `id` that a re-render replaces gets a new key, and
counts as new, so give an `id` to elements whose interactions should carry over.

## Debugging

In the HUD's **Menu**, **Debug on** switches the debug aids on, and **Debug off** off again. They start off, unless the URL
has `?debug=true` (the [`debug` setting](configuration.md)). In camera mode they:

- tint each player differently;
- mark each player's head, hands and feet, with the same drawing as the calibration page. In a 2.5D scene, the floor is
  outlined, and each foot is green on it and red off it. A player the tracker is holding while they are missed is
  marked faded (they can't interact until found again);
- show the vision stats readout over the silhouette: the frame rate, the time each step takes (inference, tracking,
  monitors, drawing), and the people, hands and feet found. `?showFps=true` shows the readout on its own;
- draw a bright green line across each player at the height of the ground point their [position](#player-positions)
  comes from, and shade what is off the floor in a 2.5D scene.

Lower a rule's `threshold` when testing interactions, and use the feet markers to see where the
camera thinks the player is. Switching the debug aids restarts the tracking loop with the new
mask type, and cancels the old one; check the console for model or "disposed" errors after
toggling it.

## Where the code lives

| Path                                                  | What it does                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/config/AppConfig.ts`                             | the settings, their defaults, and reading them from `.env` and the URL                                             |
| `src/components/camera/CharacterCamera.tsx`           | webcam stream and the preview video                                                                                |
| `src/components/camera/CameraChoice.ts`               | the saved camera choice and mirror setting                                                                         |
| `src/components/landing/CameraPicker.tsx`             | the landing page's dropdown, checkbox and preview (`useCameraPicker.ts`)                                           |
| `src/components/camera/PlayerCanvases.ts`             | one canvas and wrapper per player, and the hidden reference canvas                                                 |
| `src/components/camera/PlayerRegistry.ts`             | stable player ids and numbers, player states, and notes of lost players; see [player tracking](player-tracking.md) |
| `src/components/camera/PlayerStatic.ts`               | how a player's static changes over time                                                                            |
| `src/components/camera/PlayerPosition.ts`             | each player's ground point, held through jumps, and their position on the floor or in the scene                    |
| `src/components/camera/PositionPublisher.ts`          | players' positions for rules and templates: quantised, with hysteresis, rate-limited                               |
| `src/components/core/layout/FloorPlacement.ts`        | placing, scaling and sorting floor items; the debug warning for targets off the floor                              |
| `src/components/core/layout/FloorSurfacePlacement.ts` | drawing floor surfaces onto the screen with a `matrix3d`, and their painting order                                 |
| `src/components/camera/CharacterCanvas.tsx`           | tracking loop; draws the silhouettes; reports players and feet; the stats readout                                  |
| `src/components/camera/DrawPeople.ts`                 | cuts the people out of the video, and tints them for debugging                                                     |
| `src/components/camera/DrawPlayers.ts`                | draws each player on their canvas, frozen or with static, sorted to their floor depth                              |
| `src/components/camera/PlayerMonitor.ts`              | turns body-part coverage and feet into edge-triggered interactions                                                 |
| `src/components/camera/JumpDetector.ts`               | follows a player's feet for jumps                                                                                  |
| `src/components/camera/CameraSupport.ts`              | camera request and feet position                                                                                   |
| `src/components/camera/FloorGeometry.ts`              | every conversion between the camera picture, the screen and the floor; the crop                                    |
| `src/components/camera/FloorSurfaces.ts`              | where floor tiles, walls, backgrounds, the ground and the horizon appear on screen                                 |
| `src/components/camera/FloorCalibration.ts`           | each camera's saved floor                                                                                          |
| `src/components/camera/FloorOverlay.tsx`              | the floor outline and body-part markers, for calibration and debugging                                             |
| `src/components/landing/CalibrationView.tsx`          | the calibration page                                                                                               |
| `src/components/camera/FrameStats.ts`                 | frame rate, inference time, and what each frame found                                                              |
| `src/vision/FootstepsVisionModelImplementation.ts`    | the base class every vision model implements, with the body-part queries                                           |
| `src/vision/BodyPart.ts`, `VisionTypes.ts`            | our body parts, and the frames models return                                                                       |
| `src/vision/VisionQueries.ts`                         | body parts at a point or in an area; splitting one silhouette between people                                       |
| `src/vision/Tracking.ts`                              | stable player ids, key-point smoothing, holding lost players, and filling gaps                                     |
| `src/vision/models/`                                  | BodyPix, MediaPipe Pose and MoveNet, and the tfjs backend choice                                                   |
| `src/vision/VisionWorkerProxy.ts`, `vision.worker.ts` | runs a model in a web worker                                                                                       |
| `src/components/core/logic/AvatarModeUtils.ts`        | per-scene avatar mode resolution, and what each mode can fire                                                      |
| `src/components/core/layout/MouseFeetHook.ts`         | [mouse-feet](#mouse-feet): the pointer as player 1's feet, and drags as jumps                                      |
| `src/components/core/logic/GameClickUtils.ts`         | targets, and the state changes for clicks and interactions                                                         |
| `src/components/core/layout/GameLayersLayout.tsx`     | the layer stack, scene transitions, shared camera state, and the interaction hook                                  |
| `src/components/core/layout/useSceneTransition.ts`    | fades scene changes and times the camera reshape and reduced motion                                                |
| `src/components/core/layout/PlayerInteractionHook.ts` | one monitor per player, and mask-space target rectangles                                                           |
| `src/components/core/layout/GameLayerWrappers.tsx`    | one wrapper component per layer                                                                                    |
| `src/components/core/effects/`                        | [special effects](special-effects.md): their targets, and playing them on items and players                        |

## Testing

Unit tests cover the camera choice (`tests/CameraPicker.test.tsx`), player depth (`tests/Depth.test.ts`), per-player
canvases (`tests/PlayerCanvases.test.ts`), the avatar mode resolution (`tests/AvatarModeUtils.test.ts`), mouse-feet (`tests/MouseFeetHook.test.tsx`), the monitor and its jump
interactions (`tests/PlayerMonitor.test.ts`), jump detection (`tests/JumpDetector.test.ts`), feet (`tests/CameraSupport.test.ts`), the floor geometry and mask rectangles (`tests/FloorGeometry.test.ts`), saved
floors (`tests/FloorCalibration.test.ts`), the floor overlay (`tests/FloorOverlay.test.tsx`), the calibration page
(`tests/CalibrationView.test.tsx`), the
tracking loop (`tests/CharacterCanvas.test.tsx`), the config (`tests/AppConfig*.test.ts*`), each vision
model and the worker proxy (`tests/*Model.test.ts`, `tests/VisionWorkerProxy.test.ts`), the body-part
queries and tracking (`tests/VisionQueries.test.ts`, `tests/Tracking.test.ts`), and the layout and game
wiring, including the scene fades and camera reshape timings, waiting for a camera shape, and reduced
motion.

The browser suite runs the real vision pipeline in Chromium against a fake webcam. It samples the
viewport mid-reshape, waits for the new scene to fade in, and checks that the fitted game view
contains every stepping stone:

```bash
npx playwright install chromium  # once
scripts/run-browser-tests.sh
```

It is local only, needs network access to download the model, and takes about 2–3 minutes on Apple
Silicon. The opt-in vision benchmark shows the fake webcam 25 photos of people and reports, for each, the frame
rate, inference time, and the people, hands and feet found:

```bash
VISION_BENCH=1 scripts/run-browser-tests.sh vision-bench
VISION_BENCH=1 VISION_BENCH_QUERY="&visionModel=mediapipe" scripts/run-browser-tests.sh vision-bench
```

The fake webcam is 1280×720, like the real camera (`VISION_BENCH_CAMERA=640x480` changes it).
`VISION_BENCH_SHOTS=<folder>` also saves each scene's debug view, named `VISION_BENCH_LABEL-<scene>.png`. See [manual testing](testing/manual-testing.md) for what it proves, the
manual checks with a real camera, and how to debug a failure.
