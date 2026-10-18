import type { CSSProperties } from "react";
import type { GameDisplayComponentBase } from "./GameDisplayData";

export type TemplateSourceType = "local" | "relative" | "url" | "embedded";

export interface GameDisplayTemplateComponentData extends GameDisplayComponentBase {
  type: "template";
  backgroundTemplate?: GameDisplayTemplateSourceData;
  foregroundTemplate?: GameDisplayTemplateSourceData;
  backgroundStyle?: CSSProperties;
  foregroundStyle?: CSSProperties;
  backgroundTemplateStyle?: CSSProperties;
  foregroundTemplateStyle?: CSSProperties;
}

export interface GameDisplayTemplateSourceData {
  sourceType: TemplateSourceType;
  templateSource?: string;
  content?: string;
}
