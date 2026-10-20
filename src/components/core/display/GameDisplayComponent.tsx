import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";
import type { GameDisplayRenderData } from "../logic/RenderDataUtils";
import GameDisplayDialogComponent from "./GameDisplayDialogComponent";
import GameDisplayScrollComponent from "./GameDisplayScrollComponent";
import GameDisplayTemplateComponent from "./GameDisplayTemplateComponent";

/** Which half of a display a component renders: the background behind the camera character, or the foreground in front of it. */
export type LayerHint = "background" | "foreground";

/** Props for {@link GameDisplayComponent}. */
interface GameDisplayComponentProps {
  /** The display to render, with its template data and the challenge it belongs to. */
  render: GameDisplayRenderData;
  layerHint: LayerHint;
  /** Called when the player submits an answer in the display. */
  onAnswer?: GameAnswerFunction;
}

/**
 * Renders one half (the layer hint) of a display, using the template, dialog or scroll component to suit its type,
 * and the background or foreground source and styles to suit the hint.
 */
export default function GameDisplayComponent({ render, layerHint, onAnswer }: GameDisplayComponentProps) {
  const component = render.component;
  const background = layerHint === "background";
  const common = {
    templateSource: background ? component.backgroundTemplate : component.foregroundTemplate,
    containerStyle: background ? component.backgroundStyle : component.foregroundStyle,
    templateStyle: background ? component.backgroundTemplateStyle : component.foregroundTemplateStyle,
    templateData: render.templateData,
    challengeId: render.challengeId,
    solution: render.solution,
    onAnswer,
  };
  if (component.type === "template") return <GameDisplayTemplateComponent {...common} />;

  const paged = { ...common, contents: component.contents, layerHint, stageId: render.stageId };
  if (component.type === "scroll") return <GameDisplayScrollComponent {...paged} />;
  return (
    <GameDisplayDialogComponent
      {...paged}
      image={isDefined(component.imageResource) ? render.templateData.resources[component.imageResource] : undefined}
      margins={component.imageMargins}
    />
  );
}
