import Mustache from "mustache";
import { useEffect, useId, useState, type PropsWithChildren } from "react";
import MustacheTemplate from "react-mustache-template-component";
import type { GameDisplayTemplateSourceData as GameDisplayTemplateData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../../entities/data/GameStageData";
import useContentCache from "../../../providers/GameContentCacheHook";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";
import { summariseTemplateSource } from "../logic/TemplateUtils";

interface GameDisplayTemplateProps {
  templateSource: GameDisplayTemplateData | undefined;
  templateData: Record<string, any>;
  containerStyle?: React.CSSProperties;
  templateStyle?: React.CSSProperties;
  stageId?: GameStageId; // TODO (currently unused)
  challengeId?: GameChallengeId; // TODO (currently unused)
  solution?: GameChallengeSolution; // TODO (currently unused)
  onAnswer?: GameAnswerFunction; // TODO (currently unused)
}

const MUSTACHE_OPTIONS: Mustache.RenderOptions = {
  escape: (text) => text, // disable HTML escaping
};

export default function GameDisplayTemplateComponent({
  templateSource,
  templateData,
  containerStyle,
  templateStyle,
  children,
}: PropsWithChildren<GameDisplayTemplateProps>) {
  const [render, setRender] = useState<GameDisplayTemplateData | undefined>();
  const [containerStyleParsed, setContainerStyleParsed] = useState<React.CSSProperties>({});

  const { getTemplate } = useContentCache();

  const uid = useId();

  useEffect(() => {
    setContainerStyleParsed(
      isDefined(containerStyle)
        ? Object.fromEntries(
            Object.entries(containerStyle).map(([key, value]) => [
              key,
              Mustache.render(value, templateData, undefined, MUSTACHE_OPTIONS),
            ]),
          )
        : {},
    );
  }, [containerStyle, templateData]);

  useEffect(() => {
    async function loadTemplate() {
      const retrieved = await getTemplate(templateSource);
      setRender(retrieved);
    }
    loadTemplate();
  }, [templateSource, getTemplate]);

  return (
    <div
      id={summariseTemplateSource(templateSource)}
      key={`template-${uid}`}
      style={{ width: "100%", height: "100%", ...containerStyleParsed }}
    >
      {isDefined(render) && (
        <MustacheTemplate template={render.content ?? ""} data={templateData} style={templateStyle} />
      )}
      {children}
    </div>
  );
}
