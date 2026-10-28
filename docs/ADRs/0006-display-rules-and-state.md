# ADR 0006: Display rules and state

- Status: Accepted
- Date: 2026-10-26

## Context

Games are data, and a game repository can be remote, so nothing in it is trusted. Until now the only
behaviour a display could have was "clicking (or touching) this element opens that stage", and only on
overview displays (`clickIdToStageId`). Simple game mechanics such as toggles, counters, timers, and
reacting to the player's hands or feet each needed a React component.

We want any display to keep its own state, change it in response to events, and act on the game. This
has to be written as data, so the boundary stays where it is: templates are logic-less and sanitised,
and no game-supplied script runs.

Re-rendering a template also replaced all of its elements, so CSS transitions could not run between
states, and keyframe animations restarted.

## Options considered

### Expressions (conditions, computed values, durations)

1. **filtrex**: a small expression language (MIT licence, no dependencies). The expression is parsed
   against a fixed grammar and turned into JavaScript that filtrex writes itself. It can only read
   values it is given and call a fixed set of maths functions. Its syntax is spreadsheet-like
   (`if x then y else z`, `and`, `not`).
2. **expr-eval**: unmaintained, with known code-injection reports.
3. **jexl**: evaluates a syntax tree without generating code, but it has had no release since 2020 and
   is asynchronous by default.
4. **A hand-written parser**: no dependency, but it is a parser we would have to secure and maintain.

### Where display state lives

1. **Inside the game state** (`GameState.displayStates`): one source of truth, saved by the existing
   progress storage, and changed by the same pure functions as the rest of the game.
2. **A separate store**: only the changed display re-renders, but it needs its own subscriptions,
   saving and reset handling.

### Keeping elements between renders

1. **idiomorph**: patches the existing DOM to match new HTML, keeping elements that have the same `id`.
2. **View Transitions**: animates between snapshots, but applies to the whole document (including the
   camera canvas).
3. **Parsing the HTML into React elements**: more moving parts for a similar result.

## Decision

1. **Rules on every display component.** Each rule has a trigger (`on`), an optional condition (`if`) and
   actions (`do`). Rules find elements by CSS selector. Templates only render state and never change it.
2. **filtrex for expressions**, with two additions of our own: dotted names (`state.score`) are resolved
   through the object's own data properties only, and `true` and `false` are supplied as constants. Every
   expression is compiled when the game loads, so a mistake is reported early, naming the display and
   rule. See [how filtrex works](../filtrex.md).
3. **Display state lives in the game state**, keyed by display, and is saved alongside progress.
4. **idiomorph patches templates in place**, so elements with a stable `id` keep their transitions and
   animations.
5. **Each display handles its own events**: clicks, key activation and animation and transition ends,
   from its template's container. Only elements drawn by a template accept pointer events, so a click
   reaches whichever display's element is on top, including background layers. Camera interactions
   follow the same rule, by hit-testing the body part's position.

This partly supersedes [ADR 0002](0002-camera-interactions.md): camera targets are now found by the
rules' selectors rather than by `clickIdToStageId` element ids, and covered elements no longer respond.

## Consequences

- Toggles, counters, timers and body interactions are configured in game data, without new components.
- Game text never runs as JavaScript. filtrex generates code with `new Function`, as Handlebars already
  does, so a strict Content Security Policy without `unsafe-eval` stays out of reach for both. The fix
  for that (precompiled templates, and an evaluator that walks the syntax tree) would be needed anyway.
- Every state change re-renders the game and writes the saved progress. That is fine at the rates rules
  run (events and timers), but not for per-frame animation, which belongs in CSS.
- Anything that animates or keeps state needs an `id`. An element without one can be replaced rather
  than patched, and then counts as new.
- Expressions use filtrex's syntax rather than JavaScript's. Authors need [the cheat sheet](../filtrex.md).
- The 003 custom elements work can reuse the same state and game actions.

## Detail

- Rules are compiled by `compileGameRules` (`src/components/core/logic/GameRuleUtils.ts`). Expressions are
  compiled by `compileGameExpression` (`src/components/core/logic/GameExpressionUtils.ts`).
- filtrex returns runtime errors rather than throwing them. We log them, naming the rule, and treat the
  value as `undefined`.
