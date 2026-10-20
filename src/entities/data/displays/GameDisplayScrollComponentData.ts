import type { GameDisplayComponentBase } from "./GameDisplayData";
import type { GameDisplayMediaData } from "./GameDisplayMediaData";
import type { GameDisplayTemplateSourceData } from "./GameDisplayTemplateComponentData";

/** A display of paged text on a paper image, with optional audio and answer input per page. */
export interface GameDisplayScrollComponentData extends GameDisplayComponentBase {
  type: "scroll";
  /** Template for the background layer, drawn behind the game's other content. */
  backgroundTemplate?: GameDisplayTemplateSourceData;
  /** Template for the foreground layer, drawn in front of the game's other content. */
  foregroundTemplate?: GameDisplayTemplateSourceData;
  /** CSS for the background layer's container. */
  backgroundStyle?: React.CSSProperties;
  /** CSS for the foreground layer's container. */
  foregroundStyle?: React.CSSProperties;
  /** CSS for the element wrapping the rendered background template. */
  backgroundTemplateStyle?: React.CSSProperties;
  /** CSS for the element wrapping the rendered foreground template. */
  foregroundTemplateStyle?: React.CSSProperties;
  /** The pages of the scroll, shown one at a time in order. */
  contents: GameDisplayScrollComponentDataContent[];
}

/** One page of a scroll. */
export interface GameDisplayScrollComponentDataContent {
  /** The text of the page. */
  text?: string;
  /** If true, shows an answer input on this page. */
  showInput?: boolean;
  /**
   * A hint for this page.
   * Not yet implemented: never shown. See docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md #4.
   */
  hint?: string;
  /** Label for the answer input. Used only when `showInput` is true. */
  label?: string;
  /** Audio to play on this page. */
  media?: GameDisplayMediaData;
}
