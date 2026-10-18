import type { GameDisplayScrollComponentData } from "../../../entities/data/displays/GameDisplayScrollComponentData";
import type { GameDisplayTemplateComponentData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameAnswerFunction } from "../Game";
import type { GameDisplayRenderData } from "../logic/RenderDataUtils";
import GameDisplayScrollComponent from "./GameDisplayScrollComponent";
import GameDisplayTemplateComponent from "./GameDisplayTemplateComponent";

export type LayerHint = "background" | "foreground";

interface GameDisplayComponentProps {
  render: GameDisplayRenderData;
  layerHint: LayerHint;
  onAnswer?: GameAnswerFunction;
}

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
