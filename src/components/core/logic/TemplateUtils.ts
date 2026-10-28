import type { GameDisplayTemplateSourceData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameStageState } from "../../../entities/state/GameStageState";
import type { GameState } from "../../../entities/state/GameState";

/** The game state plus derived values, for templates, which can only look values up. */
export type DecoratedGameState = Omit<GameState, "stages"> & {
  /** Each stage's state, with its template values. */
  stages: DecoratedStageState[];
  /** The number of stages in the game. */
  totalStages: number;
};

/** A stage's state plus derived values, for templates. */
export type DecoratedStageState = GameStageState & {
  /** Zero-based position in the game's stages. */
  index: number;
  /** One-based position, for display to players. */
  oneIndex: number;
  /** The stage is completed. */
  showCompleted: boolean;
  /** The stage is available to play: unlocked and not yet completed. */
  showUnlocked: boolean;
  /** The stage is locked. */
  showLocked: boolean;
};

/** Adds the derived template values to a game state. */
export const decorateGameState = (gameState: GameState): DecoratedGameState => ({
  ...gameState,
  stages: gameState.stages.map((stageState, index) => ({
    ...stageState,
    index,
    oneIndex: index + 1,
    showCompleted: stageState.completion === "completed",
    showUnlocked: stageState.completion !== "completed" && stageState.availability === "unlocked",
    showLocked: stageState.availability === "locked",
  })),
  totalStages: gameState.stages.length,
});

/**
 * A readable, stable id for a template's container: its source type and location, or the
 * given fallback (a React useId(), so it matches between the prerendered HTML and the browser).
 */
export const summariseTemplateSource = (source: GameDisplayTemplateSourceData | undefined, fallbackId: string) =>
  `${source?.sourceType ?? "undefined"}:${source?.templateSource ?? `uid:${fallbackId}`}`;

/** Splits text into its trimmed, non-empty lines. */
export const parseLines = (text: string | undefined): string[] => {
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

/** Something that happened inside a display's template that rules can respond to. */
export interface DisplayDomEvent {
  /** A click (or key activation), the mouse moving over or out of an element, or the end of a CSS animation or transition. */
  kind: "click" | "mouseOver" | "mouseOut" | "animationEnd" | "transitionEnd";
  /** The element the event happened on. */
  target: Element;
  /** The display's template container, where matching stops. */
  root: Element;
  /** The animation's name, or the transitioned property. */
  name?: string;
  /** For mouse moves: the element the mouse came from (over) or went to (out), if any. */
  related?: Element | null;
}

/**
 * The element matching a selector that the event happened in: the target itself or its nearest matching ancestor,
 * inside the display's container (never the container itself).
 */
export const matchTarget = ({ target, root }: Pick<DisplayDomEvent, "target" | "root">, selector: string) => {
  const element = target.closest(selector);
  return element !== null && element !== root && root.contains(element) ? element : undefined;
};

/** The template containers of a display (its background and foreground), by its scope. */
export const displayRoots = (scope: string): Element[] =>
  Array.from(document.querySelectorAll("[data-display-scope]")).filter(
    (element) => element instanceof HTMLElement && element.dataset.displayScope === scope,
  );
