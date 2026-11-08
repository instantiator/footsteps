import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";
import type { GameSceneRenderData } from "../logic/RenderDataUtils";
import type { SceneDomEvent } from "../logic/TemplateUtils";
import GameSceneDialogComponent from "./GameSceneDialogComponent";
import GameSceneScrollComponent from "./GameSceneScrollComponent";
import GameSceneTemplateComponent from "./GameSceneTemplateComponent";

/** Which half of a scene a component renders: the background behind the camera character, or the foreground in front of it. */
export type LayerHint = "background" | "foreground";

/** Props for {@link GameSceneComponent}. */
interface GameSceneComponentProps {
  /** The scene to render, with its template data and the challenge it belongs to. */
  render: GameSceneRenderData;
  layerHint: LayerHint;
  /** Called when the player submits an answer in the scene. */
  onAnswer?: GameAnswerFunction;
  /** Called with events inside the scene's templates, for its rules. */
  onSceneEvent?: (event: SceneDomEvent) => void;
}

/**
 * Renders one half (the layer hint) of a scene, using the template, dialog or scroll component to suit its type,
 * and the background or foreground source and styles to suit the hint.
 */
export default function GameSceneComponent({ render, layerHint, onAnswer, onSceneEvent }: GameSceneComponentProps) {
  const component = render.component;
  const background = layerHint === "background";
  const common = {
    templateSource: background ? component.backgroundTemplate : component.foregroundTemplate,
    containerStyle: background ? component.backgroundStyle : component.foregroundStyle,
    templateStyle: background ? component.backgroundTemplateStyle : component.foregroundTemplateStyle,
    templateData: render.templateData,
    scope: render.scope,
    run: render.run,
    onSceneEvent,
  };
  if (component.type === "template") return <GameSceneTemplateComponent {...common} />;

  const paged = {
    ...common,
    contents: component.contents,
    layerHint,
    stageId: render.stageId,
    challengeId: render.challengeId,
    onAnswer,
  };
  if (component.type === "scroll") return <GameSceneScrollComponent {...paged} />;
  return (
    <GameSceneDialogComponent
      {...paged}
      image={isDefined(component.imageResource) ? render.templateData.resources[component.imageResource] : undefined}
      margins={component.imageMargins}
    />
  );
}
