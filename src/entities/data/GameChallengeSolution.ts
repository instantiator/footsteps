/**
 * Intended defaults for optional solution settings.
 * Not yet implemented: never applied. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.
 */
export const DEFAULT_GAME_CHALLENGE_SOLUTION_PROPS: Partial<GameChallengeSolution> = {
  ignoreCase: true,
  ignoreWhitespace: true,
  trimWhitespace: true,
  autoAccept: true,
};

/** An answer the player types, or a solution a game author accepts. */
export type GameChallengeAnswer = string;

/** Feedback text describing the outcome of checking an answer. */
export type GameChallengeAnswerValidation = string;

/**
 * Information about how to respond to a user's game challenge answer
 */
export interface GameChallengeSolution {
  /** One or more valid solutions for this challenge */
  answers: GameChallengeAnswer[];

  /** Solutions can be matched ignoring case, default: true */
  ignoreCase?: boolean;

  /** Solutions can be matched ignoring whitespace, default: true */
  ignoreWhitespace?: boolean;

  /** Solutions can be matched ignoring leading and trailing whitespace, default: true */
  trimWhitespace?: boolean;

  /**
   * Automatically accept a user's input if it matches a solution, default: true.
   * Not yet implemented: see docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.
   */
  autoAccept?: boolean;

  /**
   * A series of hints, to be offered in order, if requested - leave empty for no hints.
   * Not yet implemented: see docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.
   */
  hints: string[];
}
