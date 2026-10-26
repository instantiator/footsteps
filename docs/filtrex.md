# How filtrex works

Display rules use short expressions for their conditions (`if`, `when`), computed values (`set`), answers
(`answer`) and timer durations (`every`, `after`). These are written in
[filtrex](https://github.com/cshaa/filtrex), a small, safe expression language. This page explains what it
does and how to write it.

## Why it is safe

A game repository can be remote, so its data is not trusted. filtrex never runs game text as JavaScript:

1. It **parses** the expression against a fixed grammar. Anything that isn't part of the language is a
   parse error.
2. It **generates** a JavaScript function from the parsed expression, using `new Function`. The generated
   code only uses building blocks that filtrex supplies. Game text becomes quoted strings and
   property names, never code.
3. That function can only **read the values it is given** and call filtrex's built-in maths functions.
   There are no loops, no user-defined functions, no assignments, and no access to globals such as
   `window`.

We add one rule on top. A dotted name such as `state.score` is looked up one step at a time, and only
through an object's own data properties. So `state.constructor`, `__proto__` and getters are unreachable,
and a missing step gives `undefined` rather than an error.

Handlebars templates are compiled with `new Function` too, so filtrex adds no new requirement to the
site's Content Security Policy.

## What an expression can see

| Name    | What it is                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------- |
| `state` | This display's own state, starting from `initialState`.                                         |
| `data`  | The display component's `data`, as authored.                                                    |
| `game`  | A read-only snapshot of the game's progress: its stages, their challenges, and what is showing. |
| `event` | For element triggers: the matched element's `id` (empty if it has none), and the `interaction`. |

## Syntax

| Write                              | Meaning                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `state.score + 1`                  | Arithmetic: `+ - * /`, `^` (power), `mod` (always positive)       |
| `state.score >= data.target`       | Comparison: `== != < <= > >=`                                     |
| `not state.popping`                | Boolean logic: `and`, `or`, `not`                                 |
| `true`, `false`                    | Booleans                                                          |
| `if state.on then 2 else 1`        | A value that depends on a condition                               |
| `event.id in ("lava-1", "lava-2")` | Membership (`not in` too)                                         |
| `"hello"`                          | A string: always double quotes                                    |
| `'state.my-key'`                   | A name with other characters (eg. `-`): single quotes, not double |
| `max(state.a, 3)`                  | Built-ins: `abs ceil floor round sqrt min max log exists empty`   |

Values are not converted between types: `1 + true` is an error, not `2`.

## Errors

- **When the game loads**, every expression is compiled. A syntax mistake stops the game from loading,
  and the message names the display and rule, eg. `stages[1] (lava) › … › rules[2].if: Parse error …`.
- **While playing**, a value of the wrong type (eg. adding a number to text) is logged to the console,
  naming the rule, and the expression's result is treated as `undefined`. A condition that fails this way
  counts as false, and a `set` that fails leaves the value unchanged.
