import Mustache from "mustache";
import { useEffect, useId, useMemo, useState, type PropsWithChildren } from "react";
import MustacheTemplate from "react-mustache-template-component";
import type { GameDisplayTemplateSourceData as GameDisplayTemplateData } from "../../../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameChallengeId } from "../../../entities/data/GameChallengeData";
import type { GameChallengeSolution } from "../../../entities/data/GameChallengeSolution";
import type { GameStageId } from "../../../entities/data/GameStageData";
import useContentCache from "../../../providers/GameContentCacheHook";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameAnswerFunction } from "../Game";
import { summariseTemplateSource } from "../logic/TemplateUtils";

/** Props for {@link GameDisplayTemplateComponent}. */
interface GameDisplayTemplateProps {
  /** Where to get the Mustache template from; fetched via the content cache. */
  templateSource: GameDisplayTemplateData | undefined;
  /** Mustache view: any object whose fields the template may reference. */
  templateData: object;
  /** Style for the container; its values are rendered as Mustache templates over `templateData`. */
  containerStyle?: React.CSSProperties;
  /** Style for the rendered template itself. */
  templateStyle?: React.CSSProperties;
  stageId?: GameStageId; // unused: see docs/outstanding-issues.md
  challengeId?: GameChallengeId; // unused: see docs/outstanding-issues.md
  solution?: GameChallengeSolution; // unused: see docs/outstanding-issues.md
  onAnswer?: GameAnswerFunction; // unused: see docs/outstanding-issues.md
}

/** Rendering options: HTML escaping is off, so data can contribute markup and CSS. */
const MUSTACHE_OPTIONS: Mustache.RenderOptions = {
  escape: (text) => text, // disable HTML escaping
};

/**
 * Fetches a Mustache template (via the content cache) and renders it with the template data,
 * inside a container whose style is Mustache-rendered too. Children follow the rendered template.
 */
export default function GameDisplayTemplateComponent({
  templateSource,
  templateData,
  containerStyle,
  templateStyle,
  children,
}: PropsWithChildren<GameDisplayTemplateProps>) {
  const [render, setRender] = useState<GameDisplayTemplateData | undefined>();

  const { getTemplate } = useContentCache();

  const uid = useId();

  // Style values may themselves be Mustache templates over the same data
  const containerStyleParsed = useMemo(
    (): React.CSSProperties =>
      isDefined(containerStyle)
        ? Object.fromEntries(
            Object.entries(containerStyle).map(([key, value]) => [
              key,
              Mustache.render(value, templateData, undefined, MUSTACHE_OPTIONS),
            ]),
          )
        : {},
    [containerStyle, templateData],
  );

  useEffect(() => {
    async function loadTemplate() {
      const retrieved = await getTemplate(templateSource);
      setRender(retrieved);
    }
    loadTemplate();
  }, [templateSource, getTemplate]);

  return (
    <div
      id={summariseTemplateSource(templateSource, uid)}
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
