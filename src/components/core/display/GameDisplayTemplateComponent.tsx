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
  /** Style for the container; its string values are rendered as Mustache templates over `templateData`. */
  containerStyle?: React.CSSProperties;
  /** Style for the rendered template itself; its string values are rendered as Mustache templates too. */
  templateStyle?: React.CSSProperties;
  stageId?: GameStageId; // unused: see docs/outstanding-issues.md
  challengeId?: GameChallengeId; // unused: see docs/outstanding-issues.md
  solution?: GameChallengeSolution; // unused: see docs/outstanding-issues.md
  onAnswer?: GameAnswerFunction; // unused: see docs/outstanding-issues.md
}

/** Options for rendering style values: no HTML escaping, which would corrupt CSS such as URLs. */
const MUSTACHE_OPTIONS: Mustache.RenderOptions = {
  escape: (text) => text, // disable HTML escaping
};

/**
 * Renders a style's string values as Mustache templates over the data. Numbers and undefined pass
 * through unchanged.
 * @throws if a value is anything else, naming the style key, so a mistake in game data is easy to find
 */
const renderStyle = (style: React.CSSProperties | undefined, data: object): React.CSSProperties =>
  Object.fromEntries(
    Object.entries(style ?? {}).map(([key, value]: [string, unknown]) => {
      if (typeof value === "string") return [key, Mustache.render(value, data, undefined, MUSTACHE_OPTIONS)];
      if (typeof value === "number" || value === undefined) return [key, value];
      throw new Error(`Style value for "${key}" must be a string or a number, not ${typeof value}`);
    }),
  );

/**
 * Fetches a Mustache template (via the content cache) and renders it with the template data,
 * inside a container. Both styles' string values are Mustache-rendered too. Children follow the rendered template.
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

  const containerStyleParsed = useMemo(() => renderStyle(containerStyle, templateData), [containerStyle, templateData]);
  const templateStyleParsed = useMemo(() => renderStyle(templateStyle, templateData), [templateStyle, templateData]);

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
        <MustacheTemplate template={render.content ?? ""} data={templateData} style={templateStyleParsed} />
      )}
      {children}
    </div>
  );
}
