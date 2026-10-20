import type { CSSProperties } from "react";
import type { GameDisplayComponentBase } from "./GameDisplayData";

/**
 * Where a template is read from: `local` (path on this site), `relative` (relative to the repository's location),
 * `url` (absolute URL, fetched as-is) or `embedded` (text inline in `content`).
 */
export type TemplateSourceType = "local" | "relative" | "url" | "embedded";

/** A display built from Handlebars templates, drawn as a background layer and a foreground layer. */
export interface GameDisplayTemplateComponentData extends GameDisplayComponentBase {
  type: "template";
  /** Template for the background layer, drawn behind the game's other content. */
  backgroundTemplate?: GameDisplayTemplateSourceData;
  /** Template for the foreground layer, drawn in front of the game's other content. */
  foregroundTemplate?: GameDisplayTemplateSourceData;
  /** CSS for the background layer's container. */
  backgroundStyle?: CSSProperties;
  /** CSS for the foreground layer's container. */
  foregroundStyle?: CSSProperties;
  /** CSS for the element wrapping the rendered background template. */
  backgroundTemplateStyle?: CSSProperties;
  /** CSS for the element wrapping the rendered foreground template. */
  foregroundTemplateStyle?: CSSProperties;
}

/** Says where to find a template's text. */
export interface GameDisplayTemplateSourceData {
  /** How `templateSource` is resolved, or `embedded` to use `content`. */
  sourceType: TemplateSourceType;
  /** Path or URL of the template, interpreted according to `sourceType`. Unused for `embedded`. */
  templateSource?: string;
  /** The template text itself. Used only when `sourceType` is `embedded`. */
  content?: string;
}
