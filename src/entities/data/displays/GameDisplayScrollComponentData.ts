import type { GameDisplayComponentBase } from "./GameDisplayData";
import type { GameDisplayMediaData } from "./GameDisplayMediaData";
import type { GameDisplayTemplateSourceData } from "./GameDisplayTemplateComponentData";

export interface GameDisplayScrollComponentData extends GameDisplayComponentBase {
  type: "scroll";
  backgroundTemplate?: GameDisplayTemplateSourceData;
  foregroundTemplate?: GameDisplayTemplateSourceData;
  backgroundStyle?: React.CSSProperties;
  foregroundStyle?: React.CSSProperties;
  backgroundTemplateStyle?: React.CSSProperties;
  foregroundTemplateStyle?: React.CSSProperties;
  contents: GameDisplayScrollComponentDataContent[];
}

export interface GameDisplayScrollComponentDataContent {
  text?: string;
  showInput?: boolean;
  hint?: string;
  label?: string;
  media?: GameDisplayMediaData;
}
