import type { GameDisplayScrollComponentData } from "../../../entities/data/displays/GameDisplayScrollComponentData";
import type { GameDisplayTemplateComponentData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameAnswerFunction } from "../Game";
import type { GameDisplayRenderData } from "../logic/RenderDataUtils";
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
 * Renders one half (the layer hint) of a display, using the template or scroll component to suit its type,
 * and the background or foreground source and styles to suit the hint.
 */
export default function GameDisplayComponent({ render, layerHint, onAnswer }: GameDisplayComponentProps) {
  const getTemplateSource = (
    component: GameDisplayTemplateComponentData | GameDisplayScrollComponentData,
    layerHint: LayerHint,
  ) => (layerHint === "background" ? component.backgroundTemplate : component.foregroundTemplate);

  const getContainerStyle = (
    component: GameDisplayTemplateComponentData | GameDisplayScrollComponentData,
    layerHint: LayerHint,
  ) => (layerHint === "background" ? component.backgroundStyle : component.foregroundStyle);

  const getTemplateStyle = (
    component: GameDisplayTemplateComponentData | GameDisplayScrollComponentData,
    layerHint: LayerHint,
  ) => (layerHint === "background" ? component.backgroundTemplateStyle : component.foregroundTemplateStyle);

  return (
    <>
      {render.component.type === "template" && (
        <GameDisplayTemplateComponent
          templateSource={getTemplateSource(render.component, layerHint)}
          containerStyle={getContainerStyle(render.component, layerHint)}
          templateStyle={getTemplateStyle(render.component, layerHint)}
          templateData={render.templateData}
          challengeId={render.challengeId}
          solution={render.solution}
          onAnswer={onAnswer}
        />
      )}
      {render.component.type === "scroll" && (
        <GameDisplayScrollComponent
          templateSource={getTemplateSource(render.component, layerHint)}
          containerStyle={getContainerStyle(render.component, layerHint)}
          templateStyle={getTemplateStyle(render.component, layerHint)}
          templateData={render.templateData}
          scrollData={render.component}
          layerHint={layerHint}
          stageId={render.stageId}
          challengeId={render.challengeId}
          solution={render.solution}
          onAnswer={onAnswer}
        />
      )}
    </>
  );
}
