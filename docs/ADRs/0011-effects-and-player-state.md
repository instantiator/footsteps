# ADR 0011: Effects and player state

- Status: Accepted, pending a real-camera check
- Date: 2026-11-04

## Context

Games need items that shake, fall, move and pulse, and players who can fall, be knocked away, freeze, fade or turn to static. Some of these remove a player until a display resets. Three things stood in the way:

- A display's reset didn't end what it had started: timers kept running, and template animations carried on.
- A player's canvas followed their place in the frame's list, and tracking was built for drawing and interactions, where a mistake lasts a moment. A removal lasts until a display resets.
- The rule engine is pure ([ADR 0006](0006-display-rules-and-state.md)), so nothing in it can wait or animate.

## Options considered

### Playing effects on elements

1. **The Web Animations API.** Animations aren't in the `style` attribute that template re-renders rewrite, so they survive them, and they can add to what an element already has.
2. **Inline styles, re-applied every frame**, as depth does. Needs a frame loop with no camera, and fights the template's own styles.
3. **CSS classes in templates, set from state.** Works today, as the rules demo's balloons do, but makes every author write the keyframes, and can't measure where an element is.

### Ending what a display started

1. **A run counter per display**, bumped as it shows, closes and resets. Everything it started belongs to one run: keying the template's body on it rebuilds the template, and timers, delays and effects are dropped when it has moved on.
2. **Cancelling everything explicitly.** A list per display of what to cancel, and CSS animations don't restart when cancelled, only when their name changes.

### Following players

1. **A registry between the tracker and everything else**, keeping stable ids, numbers and state, and a note of where a player was lost.
2. **Longer tracking in `PersonTracker`.** Would change what drawing and interactions see, and can't survive a tracking loop restarting.
3. **Recognising people by appearance.** Would solve crossing and walking out of shot, at a large cost in code and frame rate.

### Moving a player without touching mirroring

1. **A wrapper around each canvas**, for effects, depth and classes, with a hidden reference canvas to measure against. Mirroring stays on the canvas, so `transform-origin` can sit on the body.
2. **Mirroring when drawing**, which would touch every drawing and measuring path.

## Decision

Option 1 in each: the Web Animations API, a run counter, a registry, and wrappers.

Effects animate the individual `translate`, `rotate` and `scale` properties rather than `transform`, so an item's own transform doesn't bend them, with `composite: "add"` so several combine. Effects with a lasting end call `persist()`, or the browser may drop them once a later one covers the same property, snapping the item back.

Rules stay pure: effects and delays are queued in `GameState.session`, and hooks take them from there, as they do for sounds. On close, an item effect is left to die with its template rather than being cancelled, or a fallen item would snap back into view during the scene's fade.

A reset now makes a display start afresh, including firing its `start` rules again. A `start` rule that resets is an error on load, and a display that resets itself more than 10 times in a second is logged and stopped.

## Consequences

- A template is rebuilt, not patched, on any reset, or when it moves to another display. CSS animations can no longer carry over between a challenge's displays that use the same ids.
- `cqw` and `cqh` measure a dialog's cell inside a dialog, as it is a size container, so effects scale for it. Authored CSS can't.
- Players who cross can swap, and a stranger walking through a note's place inherits it: [player tracking](../player-tracking.md#limits). This is accepted until a real-camera check says otherwise.
- `filter` on a player's wrapper redraws a display-sized filter each camera frame. The vision bench can't see this, as its frame rate is the vision loop's.
- The bench showed no measurable cost from wrappers (one person went from 16.0 to 16.5 fps, within noise), near rules, or static on all players (draw time up 0.4 ms per frame).
