import type { SceneScope } from "../../../entities/state/GameState";
import { sceneRoots } from "../logic/TemplateUtils";

/** A point on screen, or a distance on it. */
export interface ScreenPoint {
  /** Across, from the left. */
  x: number;
  /** Down, from the top. */
  y: number;
}

/** Marks the frame around a dialog or scroll's image and text, which a quake moves as a whole. */
export const DISPLAY_FRAME_CLASS = "displayFrame";

/** Marks a dialog or scroll's own size container, so `cq*` units inside it measure it, not the scene. */
export const DIALOG_CONTAINER_CLASS = "dialogContainer";

/** The classes targets can use to reach what isn't inside a scene's templates. */
const OUTSIDE_TEMPLATES = ".player, .display-foreground, .display-background";

/** The classes of the layers' containers, whose items an effect moves in their place. */
const LAYER_CONTAINERS = ".display-foreground, .display-background";

/** An item with something inside it that sorts among players, which a stacking context on the item would trap. */
const holdsDepthItems = (element: Element): boolean => element.querySelector("[data-depth]") !== null;

/** An item as an effect should treat it: its children, and theirs, if it holds items that sort among players. */
const withoutDepthWrappers = (element: Element): Element[] =>
  holdsDepthItems(element) ? Array.from(element.children).flatMap(withoutDepthWrappers) : [element];

/** The items in a scene's template: its frame if it is a dialog or scroll, as a quake must keep those lined up. */
const itemsOf = (root: Element): Element[] => {
  const frame = root.closest(`.${DISPLAY_FRAME_CLASS}`);
  if (frame !== null) return [frame];
  return Array.from(root.querySelectorAll(":scope > .templateBody > *")).flatMap(withoutDepthWrappers);
};

/** A matching element as an effect should treat it: a layer's container gives the items inside it. */
const asItems = (element: Element): Element[] =>
  element.matches(LAYER_CONTAINERS)
    ? Array.from(element.querySelectorAll("[data-display-scope]")).flatMap(itemsOf)
    : [element];

/**
 * The elements an effect applies to: those its target matches inside its scene, plus the special classes for
 * players and layers, which are outside any scene. Two challenges side by side may use the same ids, so one doesn't
 * reach the other.
 * @param scope the scene whose rule fired
 * @param selector the effect's target; without one, every item in the shown scenes
 * @param shownScopes the scenes shown now
 */
export const resolveTargets = (
  scope: SceneScope,
  selector: string | undefined,
  shownScopes: SceneScope[],
): Element[] => {
  if (selector === undefined) return [...new Set(shownScopes.flatMap(sceneRoots).flatMap(itemsOf))];
  const inScene = sceneRoots(scope).flatMap((root) => Array.from(root.querySelectorAll(selector)));
  const outside = Array.from(document.querySelectorAll(selector)).filter((element) =>
    element.matches(OUTSIDE_TEMPLATES),
  );
  return [...new Set([...inScene, ...outside].flatMap(asItems))];
};

/** The wrappers of the chosen players: everyone, or the one with this number. */
export const playerWrappers = (choice: "triggering" | "all", number: number): Element[] =>
  Array.from(document.querySelectorAll(choice === "all" ? ".player" : `.player-${number}`));

/** Warns about a target that traps items sorting among players, as moving or filtering it makes a stacking context. */
export const warnIfTrappingDepth = (elements: Element[], selector: string | undefined, where: string): void => {
  if (selector === undefined || !elements.some(holdsDepthItems)) return;
  console.warn(`${where}: "${selector}" holds data-depth items, which can't sort among players during this effect`);
};

/** The whole scene an element is in. */
const viewportOf = (element: Element): Element | null => element.closest(".gameViewport");

/** The whole scene's bounds around an element, or the element's own if it isn't in one (eg. in tests). */
export const sceneRect = (element: Element): DOMRect => (viewportOf(element) ?? element).getBoundingClientRect();

/**
 * A distance as a % of the scene, as CSS that means that wherever the element is. `cqw` and `cqh` measure the nearest
 * size container, which is the scene except inside a dialog or scroll, so those are scaled to match.
 */
export const sceneDistance = (element: Element, { x, y }: ScreenPoint): string => {
  const scene = sceneRect(element);
  const container = element.parentElement?.closest(`.${DIALOG_CONTAINER_CLASS}`)?.getBoundingClientRect() ?? scene;
  const scaleX = container.width > 0 ? scene.width / container.width : 1;
  const scaleY = container.height > 0 ? scene.height / container.height : 1;
  return `${x * scaleX}cqw ${y * scaleY}cqh`;
};

/** The centre of an element on screen. */
export const centreOnScreen = (element: Element): ScreenPoint => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
};
