import type { GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameStageId } from "../../../entities/data/GameStageData";
import type { GameState } from "../../../entities/state/GameState";
import { goToChallenge, enterStage } from "./GameClickUtils";
import { resetChallenge, withoutFocus } from "./GameStateUtils";

/** A challenge, by its stage. */
export interface ChallengeRef {
  /** The challenge's stage. */
  stageId: GameStageId;
  /** The challenge. */
  challengeId: GameChallengeId;
}

/** A Go to destination that isn't a stage or challenge. */
interface GoToPlace {
  /** The catalogue of games, the game's landing page, its title screen, or its stages overview. */
  kind: "catalogue" | "game" | "title" | "overview";
}

/** Go to a stage. */
interface GoToStage {
  /** Opens a stage. */
  kind: "stage";
  /** The stage. */
  stageId: GameStageId;
}

/** Go to a challenge, which its stage then shows first. */
interface GoToChallenge extends ChallengeRef {
  /** Opens a challenge's stage, showing it. */
  kind: "challenge";
}

/** Where the HUD's Go to can take the player. */
export type GoToTarget = GoToPlace | GoToStage | GoToChallenge;

/** One entry in a HUD list. */
export interface HudOption<T> {
  /** What the entry shows. */
  label: string;
  /** Whether it can't be picked, eg. a completed or locked stage. */
  disabled: boolean;
  /** What picking it does. */
  target: T;
}

/** Indents a challenge under its stage; a select can't style its options, so no-break spaces do it. */
const INDENT = "    ";

/** Marks a completed entry, and a locked one. */
const mark = (completed: boolean, locked: boolean): string => (completed ? "✓ " : locked ? "🔒 " : "");

/**
 * Everywhere the HUD's Go to offers, in order: the catalogue, the game's landing page, its title and stages overview
 * (if it has them), then each stage followed by its challenges. Completed and locked entries can't be picked.
 * Stages and challenges have no names of their own, so they are numbered, eg. "Stage: 2" and "Challenge: 2.1".
 */
export const goToOptions = (state: GameState): HudOption<GoToTarget>[] => {
  const { title, scenes } = state.gameData;
  const has = (purpose: string) => scenes.some((scene) => scene.purpose === purpose);
  const options: HudOption<GoToTarget>[] = [
    { label: "Catalogue (all games)", disabled: false, target: { kind: "catalogue" } },
    { label: `Game: ${title}`, disabled: false, target: { kind: "game" } },
  ];
  if (has("game-overview-title"))
    options.push({ label: `Title: ${title}`, disabled: false, target: { kind: "title" } });
  if (has("game-overview-stages")) {
    options.push({ label: `Overview: ${title}`, disabled: false, target: { kind: "overview" } });
  }
  state.stages.forEach(({ stage, completion, availability, challengeStates }, s) => {
    const locked = availability === "locked";
    const done = completion === "completed";
    options.push({
      label: `${mark(done, locked)}Stage: ${s + 1}`,
      disabled: done || locked,
      target: { kind: "stage", stageId: stage.id },
    });
    challengeStates.forEach(({ challenge, succeeded }, c) =>
      options.push({
        label: `${INDENT}${mark(succeeded, locked)}Challenge: ${s + 1}.${c + 1}`,
        disabled: succeeded || locked,
        target: { kind: "challenge", stageId: stage.id, challengeId: challenge.id },
      }),
    );
  });
  return options;
};

/**
 * The game state after going somewhere in the game, or undefined if it can't be reached (or isn't in the game, like
 * the catalogue).
 */
export const goTo = (state: GameState, target: GoToTarget): GameState | undefined => {
  const leaveStage = (overviewScene: "game-overview-title" | "game-overview-stages") =>
    withoutFocus({ ...state, current: { ...state.current, stageId: null, overviewScene } });
  switch (target.kind) {
    case "title":
      return leaveStage("game-overview-title");
    case "overview":
      return leaveStage("game-overview-stages");
    case "stage":
      return enterStage(state, target.stageId);
    case "challenge":
      return goToChallenge(state, target.stageId, target.challengeId);
    default:
      return undefined;
  }
};

/** Each solved challenge, for the HUD's Reset to make playable again. */
export const resetOptions = (state: GameState): HudOption<ChallengeRef>[] =>
  state.stages.flatMap(({ stage, challengeStates }, s) =>
    challengeStates.flatMap(({ challenge, succeeded }, c) =>
      succeeded
        ? [
            {
              label: `✓ Challenge: ${s + 1}.${c + 1}`,
              disabled: false,
              target: { stageId: stage.id, challengeId: challenge.id },
            },
          ]
        : [],
    ),
  );

/** The game state with a solved challenge playable again; what is showing stays as it is. */
export const resetTo = (state: GameState, { stageId, challengeId }: ChallengeRef): GameState =>
  resetChallenge(state, stageId, challengeId);
