import { compileExpression } from "filtrex";

/** What a game expression can see. */
export interface ExpressionContext {
  /** The display's own state. */
  state: Record<string, unknown>;
  /** The display component's `data`, as authored. */
  data: Record<string, unknown>;
  /** A read-only view of the game's progress. */
  game: unknown;
  /** The element an element trigger matched; empty strings otherwise. */
  event: {
    /** The matched element's `id`, or empty if it has none. */
    id: string;
    /** How the element was interacted with, eg. `click` or `hand`. */
    interaction: string;
  };
}

/** A compiled expression, ready to evaluate against a context. */
export type GameExpression = (context: ExpressionContext) => unknown;

/** Booleans are not filtrex literals, so they are supplied as constants. */
const CONSTANTS = { true: true, false: false };

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
 * functions beyond its built-ins, or prototypes.
 * @param where names the expression in error messages, eg. the display and rule it belongs to
 * @throws if the expression doesn't parse, naming `where`
 */
export const compileGameExpression = (source: string, where: string): GameExpression => {
  try {
    return compileExpression(source, { constants: CONSTANTS, customProp: dottedProp });
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
