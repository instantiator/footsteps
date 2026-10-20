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
}
