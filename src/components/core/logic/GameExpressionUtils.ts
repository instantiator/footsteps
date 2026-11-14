import { compileExpression } from "filtrex";

/** What a game expression can see. */
export interface ExpressionContext {
  /** The scene's own state. */
  state: Record<string, unknown>;
  /** The scene component's `data`, as authored. */
  data: Record<string, unknown>;
  /** A read-only view of the game's progress. */
  game: unknown;
  /** The element an element trigger matched; empty strings otherwise. */
  event: {
    /** The matched element's `id`, or empty if it has none. */
    id: string;
    /** How the element was interacted with, eg. `click` or `hand`. */
    interaction: string;
    /** The number of the player who fired the rule; 0 if no player did. */
    player: number;
  };
}

/** A compiled expression, ready to evaluate against a context. */
export type GameExpression = (context: ExpressionContext) => unknown;

/** Booleans are not filtrex literals, so they are supplied as constants. */
const CONSTANTS = { true: true, false: false };

/**
 * `random(min, max)`: a number picked evenly from `min` up to (not including) `max`, so each use can differ. Use
 * `floor(random(0, 3))` for a whole number from 0 to 2.
 * @returns an Error, which filtrex hands back as the expression's value, if the bounds aren't numbers in order
 */
export const random = (min: unknown, max: unknown): number | Error =>
  typeof min === "number" && typeof max === "number" && min <= max
    ? min + Math.random() * (max - min)
    : new Error(`random(min, max) needs two numbers, min no more than max, not ${String(min)} and ${String(max)}`);

/** The functions expressions can call, beyond filtrex's own. */
const EXTRA_FUNCTIONS = { random };

/**
 * Resolves a dotted name such as `state.score` through own data properties only, so expressions can't reach
 * prototypes (`constructor`, `__proto__`) or run getters. A missing step gives undefined rather than an error,
 * so authors can test state that hasn't been set yet.
 */
const dottedProp = (name: string, _get: unknown, object: unknown): unknown =>
  name
    .split(".")
    .reduce<unknown>(
      (value, key): unknown =>
        typeof value === "object" && value !== null ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined,
      object,
    );

/**
 * Compiles a game expression with filtrex: a sandboxed language with no access to globals,
 * functions beyond its built-ins and {@link random}, or prototypes.
 * @param where names the expression in error messages, eg. the scene and rule it belongs to
 * @throws if the expression doesn't parse, naming `where`
 */
export const compileGameExpression = (source: string, where: string): GameExpression => {
  try {
    return compileExpression(source, { constants: CONSTANTS, customProp: dottedProp, extraFunctions: EXTRA_FUNCTIONS });
  } catch (error) {
    throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

/**
 * Evaluates a compiled expression. filtrex returns runtime errors (eg. `1 + true`) rather than throwing them.
 * @returns the value, or undefined (after logging, naming `where`) if evaluation failed
 */
export const evaluateGameExpression = (
  expression: GameExpression,
  context: ExpressionContext,
  where: string,
): unknown => {
  const value = expression(context);
  if (value instanceof Error) {
    console.error(`${where}: ${value.message}`);
    return undefined;
  }
  return value;
};
