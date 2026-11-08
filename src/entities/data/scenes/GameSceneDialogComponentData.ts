import type { GameSceneComponentBase } from "./GameSceneData";
import type { GameSceneMediaData } from "./GameSceneMediaData";
import type { GameSceneTemplateSourceData } from "./GameSceneTemplateComponentData";

/** Fields of a scene that shows pages one at a time, each with optional audio and an answer input. */
export interface GameScenePagedComponentBase extends GameSceneComponentBase {
  /** Template for the background layer, drawn behind the game's other content. */
  backgroundTemplate?: GameSceneTemplateSourceData;
  /** Template for each page in the foreground layer, drawn in front of the game's other content. */
  foregroundTemplate?: GameSceneTemplateSourceData;
  /** CSS for the background layer's container. */
  backgroundStyle?: React.CSSProperties;
  /** CSS for the foreground layer's container: the column the pages are shown in. */
  foregroundStyle?: React.CSSProperties;
  /** CSS for the element wrapping the rendered background template. */
  backgroundTemplateStyle?: React.CSSProperties;
  /** CSS for the element wrapping the rendered foreground template. */
  foregroundTemplateStyle?: React.CSSProperties;
  /** The pages, shown one at a time in order. */
  contents: GameScenePageData[];
}

/** One page of a paged scene. */
export interface GameScenePageData {
  /** The text of the page. */
  text?: string;
  /** If true, shows an answer input on this page. */
  showInput?: boolean;
  /** Label for the answer input. Used only when `showInput` is true. */
  label?: string;
  /** Audio to play on this page. */
  media?: GameSceneMediaData;
}

/**
 * Space to leave between each edge of a dialog's image and its text, as CSS percentages of the image's
 * height (top, bottom) or width (left, right), e.g. `"12%"`. Use it to keep text off transparent or decorative edges.
 */
export interface GameSceneDialogMargins {
  /** From the image's top edge, as a percentage of its height. */
  top?: string;
  /** From the image's right edge, as a percentage of its width. */
  right?: string;
  /** From the image's bottom edge, as a percentage of its height. */
  bottom?: string;
  /** From the image's left edge, as a percentage of its width. */
  left?: string;
}

/** A paged scene on a background image of the game's choosing, scaled to fit, with the text kept inside its margins. */
export interface GameSceneDialogComponentData extends GameScenePagedComponentBase {
  type: "dialog";
  /** Resource name of the background image. Without one, the dialog fills its scene. */
  imageResource?: string;
  /** Where the text sits on the image. Defaults to no margin. */
  imageMargins?: GameSceneDialogMargins;
}
