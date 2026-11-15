import DOMPurify from "dompurify";
import Handlebars from "handlebars";
import { Idiomorph } from "idiomorph";
import {
  useCallback,
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
  type RefObject,
} from "react";
import type { GameSceneTemplateSourceData as GameSceneTemplateData } from "../../../entities/data/scenes/GameSceneTemplateComponentData";
import useContentCache from "../../../providers/GameContentCacheHook";
import { isDefined } from "../../../util/ObjectUtils";
import { lastPointer, trackPointer } from "../../../util/PointerPosition";
import { summariseTemplateSource, type SceneDomEvent } from "../logic/TemplateUtils";
import { keepPlacement } from "../layout/FloorPlacement";

/** Props for {@link GameSceneTemplateComponent}. */
interface GameSceneTemplateProps {
  /** Where to get the Handlebars template from; fetched via the content cache. */
  templateSource: GameSceneTemplateData | undefined;
  /** Template context: any object whose fields the template may reference. */
  templateData: object;
  /** Style for the container; its string values are rendered as Handlebars templates over `templateData`. */
  containerStyle?: React.CSSProperties;
  /** Style for the rendered template itself; its string values are rendered as Handlebars templates too. */
  templateStyle?: React.CSSProperties;
  /** Identifies the scene this template belongs to, so camera rules can find its elements. */
  scope?: string;
  /** Which run of the scene this is; a new one rebuilds the template. */
  run?: number;
  /** Called with clicks, key activations, mouse moves, and animation and transition ends inside the template. */
  onSceneEvent?: (event: SceneDomEvent) => void;
  /**
   * Whether the scene's rules follow the mouse entering and leaving elements, so the resting pointer is hit-tested
   * each frame: an element moving under a still pointer enters and leaves it, and so does a new body rendering.
   */
  watchPointer?: boolean;
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

/** Passes on the mouse moving over or out of an element in the template, with where it came from or went to. */
type HoverHandler = (target: Element, related: Element | null) => void;

/** The container's handlers, which pass events inside the template on to the scene, with the container they stop at. */
const sceneEventHandlers = (
  onSceneEvent: GameSceneTemplateProps["onSceneEvent"],
  hover: { over: HoverHandler; out: HoverHandler },
) => {
  const emit = (event: SyntheticEvent<HTMLElement>, kind: SceneDomEvent["kind"], name?: string) => {
    if (event.target instanceof Element)
      onSceneEvent?.({ kind, target: event.target, root: event.currentTarget, name });
  };
  const emitMouse = (event: MouseEvent<HTMLElement>, handler: HoverHandler) => {
    if (event.target instanceof Element)
      handler(event.target, event.relatedTarget instanceof Element ? event.relatedTarget : null);
  };
  return {
    onClick: (event: MouseEvent<HTMLElement>) => emit(event, "click"),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!isTemplateButtonActivation(event)) return;
      event.preventDefault(); // stop Space scrolling the page
      emit(event, "click");
    },
    onMouseOver: (event: MouseEvent<HTMLElement>) => emitMouse(event, hover.over),
    onMouseOut: (event: MouseEvent<HTMLElement>) => emitMouse(event, hover.out),
    onAnimationEnd: (event: AnimationEvent<HTMLElement>) => emit(event, "animationEnd", event.animationName),
    onTransitionEnd: (event: TransitionEvent<HTMLElement>) => emit(event, "transitionEnd", event.propertyName),
  };
};

/**
 * Follows the element under the pointer inside the template, from the browser's mouse events and, while `watch` is
 * on, from hit-testing the resting pointer each frame. The browser only reports an element moving under a still
 * pointer on its first pass, if at all. Each change is passed on once, whichever reports it first, and frames with no
 * change pass on nothing. A new body starts afresh, so what rests under the pointer enters it, without exits for
 * the old body's elements.
 * ponytail: one hit-test per frame while the scene has mouse rules; gate on running animations if that ever shows.
 */
function useHover(
  rootRef: RefObject<HTMLDivElement | null>,
  bodyKey: string,
  watch: boolean,
  onSceneEvent: GameSceneTemplateProps["onSceneEvent"],
) {
  const hoveredRef = useRef<Element | null>(null);
  const onSceneEventRef = useRef(onSceneEvent);
  useEffect(() => {
    onSceneEventRef.current = onSceneEvent;
  }, [onSceneEvent]);
  useEffect(trackPointer, []);
  useEffect(() => {
    hoveredRef.current = null;
  }, [bodyKey]);

  const emit = useCallback(
    (kind: "mouseOver" | "mouseOut", target: Element, related: Element | null) => {
      const root = rootRef.current;
      if (root) onSceneEventRef.current?.({ kind, target, root, related });
    },
    [rootRef],
  );
  const over: HoverHandler = useCallback(
    (target, related) => {
      if (target === hoveredRef.current) return;
      hoveredRef.current = target;
      emit("mouseOver", target, related);
    },
    [emit],
  );
  const out: HoverHandler = useCallback(
    (target, related) => {
      if (target !== hoveredRef.current) return;
      hoveredRef.current = null;
      emit("mouseOut", target, related);
    },
    [emit],
  );

  useEffect(() => {
    if (!watch) return;
    let frame = requestAnimationFrame(function hitTest() {
      const root = rootRef.current;
      const point = lastPointer();
      const found = isDefined(point) && root ? document.elementFromPoint(point.x, point.y) : null;
      const hit = found !== null && root?.contains(found) ? found : null;
      const before = hoveredRef.current;
      if (hit !== before) {
        if (before !== null) out(before, hit);
        if (hit !== null) over(hit, before);
      }
      frame = requestAnimationFrame(hitTest);
    });
    return () => cancelAnimationFrame(frame);
  }, [watch, rootRef, over, out]);

  return { over, out };
}

/**
 * Fetches a Handlebars template (via the content cache) and renders it with the template data,
 * inside a container. Both styles' string values are rendered too. Children follow the rendered template.
 *
 * The rendered HTML is patched into place rather than replaced, keeping elements with the same `id`, so CSS
 * transitions and animations carry on between renders. A new run of the scene, or another scene, starts on a new
 * body instead, which ends all of them and restarts the template's animations.
 */
export default function GameSceneTemplateComponent({
  templateSource,
  templateData,
  containerStyle,
  templateStyle,
  scope,
  run = 0,
  onSceneEvent,
  watchPointer = false,
  children,
}: PropsWithChildren<GameSceneTemplateProps>) {
  const [render, setRender] = useState<GameSceneTemplateData | undefined>();

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
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyKey = `${scope}#${run}`;
  const hover = useHover(rootRef, bodyKey, watchPointer, onSceneEvent);

  // Patches the template's DOM in place, matching elements by id, so CSS transitions run between renders
  useLayoutEffect(() => {
    if (!isDefined(html) || !bodyRef.current) return;
    Idiomorph.morph(bodyRef.current, DOMPurify.sanitize(html, SANITIZE_OPTIONS), {
      morphStyle: "innerHTML",
      callbacks: keepPlacement(),
    });
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
      ref={rootRef}
      className="templateContent"
      data-scene-scope={scope}
      style={{ width: "100%", height: "100%", ...containerStyleParsed }}
      {...sceneEventHandlers(onSceneEvent, hover)}
    >
      {isDefined(html) && (
        <div key={bodyKey} ref={bodyRef} className="templateBody" data-scene-run={run} style={templateStyleParsed} />
      )}
      {children}
    </div>
  );
}
