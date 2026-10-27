# ADR 0009: Reset displays and rule effects

- Status: Accepted
- Date: 2026-10-27

## Context

Games played with the camera need to get players ready before a display starts, such as "return to the start"
before a lava floor appears, or a countdown before balloons fall. They also need feedback when a player does
something: a sound, or a burst of particles. Display rules ([ADR 0006](0006-display-rules-and-state.md)) could do
neither.

A rule engine that stays pure (rules are data, and every change is a function of the previous state) was the
constraint: it is what lets events that arrive between renders combine safely, and what keeps the rules testable.

Camera rules could only say when a player started touching something, so "light the bulb while a hand is on it"
had no way to turn the bulb off, and a touch for one frame counted as much as standing still.

## Options considered

### Getting players ready

1. **A reset display in place of its display.** A display may have a `resetDisplay`, shown instead of it until a
   rule runs `finishReset`. The display's own rules wait until then.
2. **A state flag in the display itself.** Authors write `ready` into state and guard every rule and template with
   it. No new concepts, but every rule needs the guard, and timers and `start` run regardless.
3. **A separate challenge before the real one.** Works today, but marks progress, shows in the stage list, and
   can't come back after a lava touch.

### Sounds and rewards

1. **An effects queue in session state.** Rules add effects to a queue; the game plays and removes them. The engine
   stays pure, and effects never hold up the rules.
2. **Effects as side effects of applying a rule.** Simple, but React may run a state update twice, so sounds would
   play twice, and tests would need to mock audio in the engine.
3. **Effects that block until done** (a sequence). Easier to line up rules after a sound, but a slow or failed sound
   would stall the game.

### Ending an interaction

1. **`-exit` interactions** (`hand-exit`, …), matching `mouse-exit`, with the start renamed to `hand-enter` and so
   on. Enter and exit names can be mixed in one trigger.
2. **An `ends: true` flag on a trigger.** Fewer names, but ambiguous when a trigger mixes the mouse and the camera:
   is it ended when the hand leaves while the mouse stays?

## Decision

- Reset displays (option 1), with `showOn` set to `first-show` or `every-show`.
- An effects queue (option 1) for `sound` and `reward` actions, each with an optional `delayMs`.
- `-exit` interactions, with every camera start renamed to `-enter`. An old name stops the game loading with a
  message naming its replacement.
- `holdMs` on an `-enter` trigger fires only after the player has stayed that long, and `forMs` on a `when` fires
  only after its expression has stayed true that long. Either restarts if interrupted.
- Which reset displays are finished, and the effects waiting to play, live in **session state**
  (`GameState.session`), which is never saved. A reload shows reset displays again and drops waiting effects.

## Consequences

- Authors can add a "get ready" step to any display without touching its rules.
- Revealing a display after its reset display fades, like any display change, and camera interactions pause
  during the fade, so a foot already on the start doesn't trigger the revealed display.
- Every effect plays once, and effects from the same rule start together. There is no way yet to act when one
  ends, or to set a volume ([outstanding issues](../outstanding-issues.md)).
- Rewards are skipped with reduced motion; sounds are not. The stage-complete reward now respects reduced motion
  too.
- Every game's camera interaction names changed. The load-time message makes old data easy to fix.
- Session state is somewhere to keep per-player bookkeeping that shouldn't survive a reload.

See [how it works](#detail).

## Detail

### Reset displays

A reset display's scope is its display's scope plus `/reset` (`resetScope` in `RenderDataUtils.ts`).
`resolveResets` walks down from a display to the deepest reset display not in `session.finishedResets`, merging
camera settings on the way. `getShownDisplays` and the render-data getters show what it returns, so the rules hook,
timers and `start` only ever see the shown display. `getDisplayKey` includes the shown scope, which is what makes the
reveal fade. `applyShowResets` clears the state of a reset display each time it is shown, and forgets `every-show`
reset displays as finished when their display is shown again. `resetChallenge` forgets the challenge's reset
displays (`forgetFinishedResets` in `GameStateUtils.ts`).

### Effects

`sound` and `reward` actions append `{ id, effect }` to `session.effects`, numbering from `session.nextEffectId`.
As the numbering is part of the pure state, an update React runs twice produces the same ids. `useRuleEffects` in
`Game.tsx` remembers the highest id it has played, plays newer ones after their `delayMs` (sounds through
`playAudio`, rewards as a `RewardBurst`, one partycles hook each, as partycles fixes the animation when the hook is
made), then removes them from the queue.

Draining the queue is a state update of its own, so it can land between a `when` rule firing and its result being
applied. `useWhenRules` reruns the `when` rules on the newer state in that case, rather than dropping the result.

### Holding and exits

`PlayerMonitor` keeps, for each body-part group and element, when a streak started (`since`) and whether it
fired. An `-enter` fires after `visionStableFrames` frames and `holdMs`. An `-exit` fires once a fired `-enter` has
been away for `visionStableFrames` frames, or from `release()` when `usePlayerInteractions` drops a player who has
gone. Monitors cleared for a transition aren't released. For the mouse, `useMouseHolds` in `GameRulesHook.ts` keeps
a timer per rule and element, cancelled when the mouse leaves the element or when the display is hidden. `forMs` timers are started and
cancelled by `followHeldWhens` on the `when` rule's edges.

### Testing

`tests/ResetDisplays.test.ts`, `GameRuleUtils.test.ts`, `GameRulesHook.test.tsx`, `PlayerMonitor.test.ts` and
`Game.test.tsx` cover the engine, the hooks and the effects. `RulesDemo.test.tsx` and `tests/browser/rules.spec.ts`
play the demo's lava, balloons and bulb end to end.
