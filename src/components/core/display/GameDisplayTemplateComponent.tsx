import DOMPurify from "dompurify";
import Handlebars from "handlebars";
import { Idiomorph } from "idiomorph";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type KeyboardEvent,
  type MouseEvent,
  type TransitionEvent,
  type PropsWithChildren,
  type SyntheticEvent,
} from "react";
import type { GameSceneTemplateSourceData as GameDisplayTemplateData } from "../../../entities/data/scenes/GameSceneTemplateComponentData";
import useContentCache from "../../../providers/GameContentCacheHook";
import { isDefined } from "../../../util/ObjectUtils";
import { summariseTemplateSource, type SceneDomEvent } from "../logic/TemplateUtils";

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
  /** Identifies the display this template belongs to, so camera rules can find its elements. */
  scope?: string;
  /** Which run of the display this is; a new one rebuilds the template. */
  run?: number;
  /** Called with clicks, key activations, mouse moves, and animation and transition ends inside the template. */
  onSceneEvent?: (event: SceneDomEvent) => void;
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
 * Renders a compiled template body over the data. The result is unsanitised: sanitise it where it's inserted.
 * @returns the HTML, or undefined (after logging) if the template doesn't compile or render
 */
const renderBody = (template: HandlebarsTemplateDelegate, data: object): string | undefined => {
  try {
    return template(data);
  } catch (error) {
    console.error("Error rendering template:", error);
    return undefined;
  }
};

/**
 * Treats Enter or Space on a focused template element marked `role="button"` like a click on it.
 * Other elements (text inputs, native buttons) keep their own key handling.
 */
const isTemplateButtonActivation = (event: KeyboardEvent<HTMLElement>): boolean =>
  (event.key === "Enter" || event.key === " ") &&
  event.target instanceof Element &&
  event.target.getAttribute("role") === "button";

/** The container's handlers, which pass events inside the template on to the display, with the container they stop at. */
const displayEventHandlers = (onSceneEvent: GameDisplayTemplateProps["onSceneEvent"]) => {
  const emit = (event: SyntheticEvent<HTMLElement>, kind: SceneDomEvent["kind"], name?: string) => {
    if (event.target instanceof Element)
      onSceneEvent?.({ kind, target: event.target, root: event.currentTarget, name });
  };
  // The mouse moving over or out of an element, with where it came from or went to
  const emitMouse = (event: MouseEvent<HTMLElement>, kind: "mouseOver" | "mouseOut") => {
    if (!(event.target instanceof Element)) return;
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    onSceneEvent?.({ kind, target: event.target, root: event.currentTarget, related });
  };
  return {
    onClick: (event: MouseEvent<HTMLElement>) => emit(event, "click"),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!isTemplateButtonActivation(event)) return;
      event.preventDefault(); // stop Space scrolling the page
      emit(event, "click");
    },
    onMouseOver: (event: MouseEvent<HTMLElement>) => emitMouse(event, "mouseOver"),
    onMouseOut: (event: MouseEvent<HTMLElement>) => emitMouse(event, "mouseOut"),
    onAnimationEnd: (event: AnimationEvent<HTMLElement>) => emit(event, "animationEnd", event.animationName),
    onTransitionEnd: (event: TransitionEvent<HTMLElement>) => emit(event, "transitionEnd", event.propertyName),
  };
};

/**
 * Fetches a Handlebars template (via the content cache) and renders it with the template data,
 * inside a container. Both styles' string values are rendered too. Children follow the rendered template.
 *
 * The rendered HTML is patched into place rather than replaced, keeping elements with the same `id`, so CSS
 * transitions and animations carry on between renders. A new run of the display, or another display, starts on a new
 * body instead, which ends all of them and restarts the template's animations.
 */
export default function GameDisplayTemplateComponent({
  templateSource,
  templateData,
  containerStyle,
  templateStyle,
  scope,
  run = 0,
  onSceneEvent,
  children,
}: PropsWithChildren<GameDisplayTemplateProps>) {
  const [render, setRender] = useState<GameDisplayTemplateData | undefined>();

  const { getTemplate } = useContentCache();

  const uid = useId();

  const containerStyleParsed = useMemo(() => renderStyle(containerStyle, templateData), [containerStyle, templateData]);
  const templateStyleParsed = useMemo(() => renderStyle(templateStyle, templateData), [templateStyle, templateData]);
  const template = useMemo(
    () => (isDefined(render) ? Handlebars.compile(render.content ?? "", COMPILE_OPTIONS) : undefined),
    [render],
  );
  const html = useMemo(
    () => (isDefined(template) ? renderBody(template, templateData) : undefined),
    [template, templateData],
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyKey = `${scope}#${run}`;

  // Patches the template's DOM in place, matching elements by id, so CSS transitions run between renders
  useLayoutEffect(() => {
    if (!isDefined(html) || !bodyRef.current) return;
    Idiomorph.morph(bodyRef.current, DOMPurify.sanitize(html, SANITIZE_OPTIONS), { morphStyle: "innerHTML" });
  }, [html, bodyKey]);

  useEffect(() => {
    getTemplate(templateSource)
      .then(setRender)
      .catch((error) => {
        console.error("Error loading template:", error);
        setRender(undefined);
      });
  }, [templateSource, getTemplate]);

  return (
    // Delegates clicks and key presses from elements inside game-authored templates, which are the real controls
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      id={summariseTemplateSource(templateSource, uid)}
      key={`template-${uid}`}
      className="templateContent"
      data-display-scope={scope}
      style={{ width: "100%", height: "100%", ...containerStyleParsed }}
      {...displayEventHandlers(onSceneEvent)}
    >
      {isDefined(html) && (
        <div key={bodyKey} ref={bodyRef} className="templateBody" data-display-run={run} style={templateStyleParsed} />
      )}
      {children}
    </div>
  );
}
