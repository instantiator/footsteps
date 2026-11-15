# ADR 0012: Action runs and spawning

- Status: Accepted
- Date: 2026-11-15

## Context

A rule's actions all started at once, and only `delayMs` spaced them out, so games lined things up by matching times
by hand: a challenge completed 1.5 s after a 1 s fall, say. Sounds and rewards reported no end. A game couldn't add
elements while it ran, so Jump and duck sent a fixed pool of four obstacles round and round. Two needs cut across
both: a rule had to be able to act on "the element that fired me" (a copy has no id the author knows), and the rule
engine had to stay pure ([ADR 0006](0006-display-rules-and-state.md)), with the DOM work in hooks
([ADR 0011](0011-effects-and-player-state.md)).

## Options considered

### How rules follow what actions do

1. **Named actions, with `actionStart` and `actionEnd` triggers, `raise` and `raised`, beside today's `…End`
   triggers.** No game data changes.
2. **One `event` trigger with reserved names** (`end:fanfare`, `effect-end:item-move`). More uniform, but every game's
   rules would be rewritten, and old names would need renaming checks.

### How actions wait for each other

1. **`series` and `parallel` groups, as actions**, so they nest and take a `name` and a `delayMs`.
2. **A `then` list on each action.** Can't express "these together, then that".

### How a spawned copy starts its own effect

1. **A named spawn ends as its copy arrives, with the copy as `event`; the `"event"` target means that element.** One
   keyword serves effects, `stop` and `despawn`, on any trigger with an element.
2. **A `spawned` trigger, plus a keyword for "the copy just spawned".** Two new ideas where one does.
3. **Effects inside the spawn action.** A nested action list, and `despawn` would still need a way to name one copy.

## Decision

Option 1 in each: named actions beside today's triggers, `series` and `parallel` groups, and an `"event"` target
that a named spawn's end points at its copy.

The engine stays pure. Actions that something waits on are recorded in the game's session state, and the hooks that
play sounds, effects and spawns report each end back through a pure function, which fires the rules following it
and starts what comes next. Copies live inside the scene's rendered template, so they go when it resets or closes
(see [how it works](#detail)).

## Consequences

- An effect ends for what waits on it as it first finishes or is cut short on one element; a reward at 2.5 s at most,
  as partycles doesn't always report a burst's end. Both are in [outstanding issues](../outstanding-issues.md).
- A scene that spawns skips the "matches nothing" selector warning, as its elements come and go.
- With no player in view, a player effect in a series ends at once, so the series moves straight on.

## Detail

### Running actions

- Running actions that something waits on (a named action, a group, or an action in a group) are recorded in
  `session.runningActions`, by an id from the queues' sequence. Queued sounds, effects, spawns and delayed actions
  carry that id, and hooks report an end with `endAction`, which fires the name's `actionEnd` rules and moves the
  group on. A plain unnamed action at the top of a `do` list isn't recorded, so existing games run as before.
- A new scene run drops the scene's running actions, and `endAction` ignores a stale one, so nothing fires late.
- Named starts and ends, and raised events, reach every shown scene, with a chain guard of 10 like `when`'s.
- `logic/RuleActions.ts` holds the single-action primitives, and `logic/ActionRuns.ts` applies rules and runs
  actions. `GameRuleUtils.ts` re-exports both, so imports run one way.

### Spawned copies

- Copies are marked `data-spawned`. The template morph keeps them (`keepPlacement`'s `beforeNodeRemoved`), and
  Idiomorph (the library that patches templates in place) won't reuse a node with an id for one with a different id,
  so a copy's id also protects it.
- They live in the run's `.templateBody`, so a reset or close drops them with it.

### Moving things under a still pointer

- A scene with mouse rules hit-tests the resting pointer each frame, and `mouse-feet` stands again each frame, so
  copies moving under a still pointer meet it. The browser's events and the frame's hit-test share one record of
  what is under the pointer, so neither fires twice.
