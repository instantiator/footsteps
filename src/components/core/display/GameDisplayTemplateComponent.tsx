import DOMPurify from "dompurify";
import Handlebars from "handlebars";
import { useEffect, useId, useMemo, useState, type PropsWithChildren } from "react";
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
  /** Where to get the Handlebars template from; fetched via the content cache. */
  templateSource: GameDisplayTemplateData | undefined;
  /** Template context: any object whose fields the template may reference. */
  templateData: object;
  /** Style for the container; its string values are rendered as Handlebars templates over `templateData`. */
  containerStyle?: React.CSSProperties;
  /** Style for the rendered template itself; its string values are rendered as Handlebars templates too. */
  templateStyle?: React.CSSProperties;
  stageId?: GameStageId; // unused: see docs/outstanding-issues.md
  challengeId?: GameChallengeId; // unused: see docs/outstanding-issues.md
  solution?: GameChallengeSolution; // unused: see docs/outstanding-issues.md
  onAnswer?: GameAnswerFunction; // unused: see docs/outstanding-issues.md
}

/** Game content may come from a remote repository: allow only Handlebars' built-in helpers. */
const COMPILE_OPTIONS = { knownHelpersOnly: true };

/** Style values are CSS, not HTML: escaping would corrupt values such as URLs. */
const STYLE_COMPILE_OPTIONS = { ...COMPILE_OPTIONS, noEscape: true };

/**
 * Renders a style's string values as Handlebars templates over the data. Numbers and undefined pass
 * through unchanged.
 * @throws if a value is anything else, naming the style key, so a mistake in game data is easy to find
 */
const renderStyle = (style: React.CSSProperties | undefined, data: object): React.CSSProperties =>
  Object.fromEntries(
    Object.entries(style ?? {}).map(([key, value]: [string, unknown]) => {
      if (typeof value === "string") return [key, Handlebars.compile(value, STYLE_COMPILE_OPTIONS)(data)];
      if (typeof value === "number" || value === undefined) return [key, value];
      throw new Error(`Style value for "${key}" must be a string or a number, not ${typeof value}`);
    }),
  );

/** Game content may come from a remote repository: strip script, event handlers and forms from the HTML. */
const SANITIZE_OPTIONS = { FORBID_TAGS: ["form"] };

/**
 * Renders a template body over the data. The result is unsanitised: sanitise it where it's inserted.
 * @returns the HTML, or undefined (after logging) if the template doesn't compile or render
 */
const renderBody = (template: string, data: object): string | undefined => {
  try {
    return Handlebars.compile(template, COMPILE_OPTIONS)(data);
  } catch (error) {
    console.error("Error rendering template:", error);
    return undefined;
  }
};

/**
 * Fetches a Handlebars template (via the content cache) and renders it with the template data,
 * inside a container. Both styles' string values are rendered too. Children follow the rendered template.
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
  const html = useMemo(
    () => (isDefined(render) ? renderBody(render.content ?? "", templateData) : undefined),
    [render, templateData],
  );

  useEffect(() => {
    getTemplate(templateSource)
      .then(setRender)
      .catch((error) => {
        console.error("Error loading template:", error);
        setRender(undefined);
      });
  }, [templateSource, getTemplate]);

  return (
    <div
      id={summariseTemplateSource(templateSource, uid)}
      key={`template-${uid}`}
      style={{ width: "100%", height: "100%", ...containerStyleParsed }}
    >
      {isDefined(html) && (
        <div
          style={templateStyleParsed}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, SANITIZE_OPTIONS) }}
        />
      )}
      {children}
    </div>
  );
}
