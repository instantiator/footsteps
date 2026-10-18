export const DEFAULT_GAME_CHALLENGE_SOLUTION_PROPS: Partial<GameChallengeSolution> = {
  ignoreCase: true,
  ignoreWhitespace: true,
  trimWhitespace: true,
  autoAccept: true,
};

export type GameChallengeAnswer = string;

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

  /** Automatically accept a user's input if it matches a solution, default: true */
  autoAccept?: boolean;

  /** A series of hints, to be offered in order, if requested - leave empty for no hints */
  hints: string[];
}
