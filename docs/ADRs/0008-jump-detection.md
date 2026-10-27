# ADR 0008: Jump detection

- Status: Accepted; supersedes the jump sequence in [ADR 0002](0002-camera-interactions.md#jump-sequence)
- Date: 2026-10-27

## Context

A game element can respond to a player jumping on it. [ADR 0002](0002-camera-interactions.md) detected a jump from
how fast the feet moved between frames: up faster than a set speed, then down, then still, all while inside the
element. In practice it rarely fired, and its thresholds were fixed in the code.

There are three reasons it rarely fired:

- **There are too few frames.** At the 4–6 fps the game runs at, a non-athletic jump spends one to three frames in
  the air, which is too few to measure a speed going up and another coming down.
- **Speed was measured in frame heights.** A child far from the camera moves fewer pixels than an adult close to it,
  so their jump looked slower.
- **The model sometimes loses the player mid-jump,** often because of motion blur, which reset the sequence.

Games also want to know about a jump from one element to another, not just a jump on the spot.

## Options considered

1. **Keep measuring speed**, but make the thresholds settings. This is simple, but doesn't fix any of the three
   reasons above.
2. **Measure distance.** Note where the feet stand, and count a jump as a rise of at least a set fraction of the
   player's height, followed by a fall of at least part of that rise, within a time limit. This works with as few as
   two frames, treats near and far players alike, and skips frames where the feet are missing.
3. **Use the whole body,** for example the head and hips rising with the feet. This should be more robust to a foot
   being misplaced, but needs key points that only some models give, and more settings.

## Decision

Option 2, with three interactions, all fired when the player lands:

| Interaction | Fires on an element when the jump… |
| ----------- | ---------------------------------- |
| `jump`      | took off from it and landed on it  |
| `jump-from` | took off from it, landing anywhere |
| `jump-onto` | landed on it, from anywhere        |

Firing only on landing means that only complete jumps count. `jump-up` and `jump-down` were also suggested as names,
but were rejected because they could be read as jumping to a higher or lower platform.

The thresholds are settings (`VITE_JUMP_*`). Distances are fractions of the player's height, measured from their
feet to the top of their head.

| Setting                     | Default | Meaning                                                       |
| --------------------------- | ------- | ------------------------------------------------------------- |
| `VITE_JUMP_MIN_RISE`        | 0.04    | How far the feet must rise                                    |
| `VITE_JUMP_STILL`           | 0.02    | How far the feet may wander while standing                    |
| `VITE_JUMP_MIN_GROUNDED_MS` | 100     | How long the feet must stand before a take-off counts         |
| `VITE_JUMP_MAX_RISE_MS`     | 500     | The longest the feet may keep rising after leaving the ground |
| `VITE_JUMP_MAX_AIRTIME_MS`  | 1000    | The longest from leaving the ground to landing                |
| `VITE_JUMP_MIN_DESCENT`     | 0.5     | How much of the rise the feet must come back down             |

See [how the defaults were chosen](#defaults).

## Consequences

- Jumps are detected at low frame rates, for children and adults, near and far.
- Jumps between elements can drive a game (eg. "jump onto the lily pad").
- Walking towards or away from the camera moves the feet in the image the way a jump does, so the model leans on
  the shape of the movement to tell them apart. Stepping back looks like a rise that never comes down, so it is
  abandoned. Stepping forward is a fall with no rise before it, so it is ignored. A quick step back and forth could
  still look like a jump.
- The defaults are estimates. They still need tuning in front of a real camera with real players.
- `jump-onto` fires on the first frame that has come down far enough. When landing on an element nearer the camera
  (lower on screen), the feet may not be over it yet on that frame.

## Detail

### The detector

`JumpDetector` (`src/components/camera/JumpDetector.ts`) follows the lower foot's height (`feetOf`), one detector per
player.

- **Standing.** The ground follows the feet down at once, which covers stepping forward. It follows them up only
  after they have stayed above it, without taking off, for `maxRiseMs`, which covers stepping back. Each rise is
  measured from that fixed ground, so at 30 fps a jump whose individual steps between frames fall inside `still`
  still adds up to a take-off.
- **Take-off.** The feet are at least `minRise` above the ground, having stood for at least `minGroundedMs`.
- **In the air.** The detector tracks the highest point. It abandons the jump if the feet are still rising after
  `maxRiseMs`, or if `maxAirtimeMs` passes, and wherever the feet are then becomes the ground. A frame with the feet
  missing is skipped.
- **Landing.** The feet have come back down at least `minDescent` of the rise. Below 1, so a jump backwards, which
  lands higher in the image, still counts.

`PlayerMonitor` notes which jump targets the feet cover each frame, and keeps the set from the last frame before
take-off. On landing, it compares that set with the targets the feet cover now. A player the tracker is holding
([ADR 0007](0007-camera-flicker.md)) doesn't update their monitor, so the jump waits for them.

### Defaults

Maximal countermovement jumps (a crouch, then a jump) give an upper bound:

- Colombian schoolchildren aged 9 to 17 had median heights of about 24–38 cm for boys and 22–27 cm for girls
  ([FUPRECOL](https://pure.urosario.edu.co/en/publications/vertical-jump-and-leg-power-normative-data-for-colombian-schoolch/)).
- A force-platform study of children aged 4 to 17 found that jump height rises with age, and is only reliable from
  about 10 ([Konstanz](https://kops.uni-konstanz.de/entities/publication/74cd3dae-5ec8-4014-b231-9e0931cbfeee/full)).
- National-team athletes reach 48–63 cm in the best-jumping sport, sprinting, with men about 10 cm higher than women
  ([Haugen et al.](https://www.researchgate.net/publication/339940034_Countermovement_Jump_Height_in_National-Team_Athletes_of_Various_Sports_A_Framework_for_Practitioners_and_Scientists)).
  Untrained adults jump well below that. No general-population reference values were found, and 20–35 cm is an
  estimate.

Players in a game hop rather than jump with full effort, so the defaults are set for small hops. A hop of h metres
spends 2√(2h/g) seconds in the air: about 0.2 s for 5 cm, 0.29 s for 10 cm and 0.45 s for 25 cm.

- **`minRise` 0.04** is about 5 cm for a 1.3 m child, or 7 cm for a 1.75 m adult. It is twice `still`.
- **`still` 0.02** allows for the model's frame-to-frame jitter in foot placement, which is about 1–2% of height in
  the bench photos.
- **`maxRiseMs` 500 and `maxAirtimeMs` 1000** cover the longest playful jumps (about 0.5 s in the air), with a frame
  of slack either side at 5 fps.
- **`minDescent` 0.5** separates a jump back (which comes down by most of the rise) from a step back (which doesn't
  come down at all).

### Testing

`tests/JumpDetector.test.ts` runs sequences at 5 and 30 fps:

- a jump on the spot, a jump forward and a jump back;
- a dropout in mid-air;
- stepping back, walking forward and jitter;
- standing too briefly, and rising too slowly;
- the same hop measured against a child's height and an adult's.

`tests/PlayerMonitor.test.ts` covers which elements fire which jump interaction.
