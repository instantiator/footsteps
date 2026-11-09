import { useEffect, type RefObject } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import { placeOnFloor, viewportToFloor, type FloorView, type Rect } from "../../camera/FloorGeometry";
import type { FloorArea } from "../../camera/FloorSurfaces";
import { sceneRoots } from "../logic/TemplateUtils";
import type { CameraRuleTarget } from "./PlayerInteractionHook";
import { DEPTH_STACK_CLASS, depthZIndex } from "../../camera/PlayerPosition";
import type { Point } from "../../../vision/VisionTypes";
import { FLOOR_AREA_ATTRIBUTE } from "./FloorSurfaceClasses";
import {
  numberOf,
  parseFloorArea,
  placeSurface,
  setStyle,
  SURFACE_PROPERTIES,
  SURFACE_SELECTOR,
} from "./FloorSurfacePlacement";

/** The selector for items placed on the floor. */
export const FLOOR_ITEM_SELECTOR = "[data-floor-y]";

/** Where an item stands on the floor, from its `data-floor-*` attributes. */
export interface FloorItem {
  /** How far forward it stands: 0 at the back edge, 100 at the front. */
  y: number;
  /** Where across it stands, 0–100 from the screen's left; where the layout puts it if not given. */
  x?: number;
  /** How high above the floor its anchor sits, in floor x units. */
  height: number;
  /** The point on the item that stands there, in CSS `transform-origin` syntax. */
  anchor: string;
  /** The band of floor y, centred on the item, that a player must stand in to interact with it; none for anywhere. */
  thickness?: number;
}

/** The anchor when none is given: the middle of the item's bottom edge, the point that touches the floor. */
const DEFAULT_ANCHOR = "center bottom";

/** An item's floor attributes, which come from game content; null if it has no valid `data-floor-y`. */
export const parseFloorItem = (element: Element): FloorItem | null => {
  const y = numberOf(element.getAttribute("data-floor-y"));
  if (!isDefined(y)) return null;
  const anchor = element.getAttribute("data-floor-anchor")?.trim();
  return {
    y,
    x: numberOf(element.getAttribute("data-floor-x")),
    height: numberOf(element.getAttribute("data-floor-height")) ?? 0,
    anchor: anchor === undefined || anchor === "" ? DEFAULT_ANCHOR : anchor,
    thickness: numberOf(element.getAttribute("data-floor-thickness")),
  };
};

/**
 * The part of the floor a player must stand on to interact with an element, if it has one: a floor area's rectangle,
 * or the band of floor y across a thick floor item.
 */
export const floorRegionOf = (element: Element): FloorArea | undefined => {
  const area = element.closest(`[${FLOOR_AREA_ATTRIBUTE}]`);
  if (area) return parseFloorArea(area.getAttribute(FLOOR_AREA_ATTRIBUTE));
  const item = element.closest(FLOOR_ITEM_SELECTOR);
  const floor = item === null ? null : parseFloorItem(item);
  if (!isDefined(floor?.thickness)) return undefined;
  return {
    left: -Infinity,
    back: floor.y - floor.thickness / 2,
    right: Infinity,
    front: floor.y + floor.thickness / 2,
  };
};

/** Whether a floor point is in a region. */
export const isInRegion = ({ x, y }: Point, { left, back, right, front }: FloorArea): boolean =>
  x >= left && x <= right && y >= back && y <= front;

/** Where the layout puts an element's top left, in page pixels, ignoring any transforms. */
const layoutOffset = (element: HTMLElement): Point => {
  let [x, y] = [0, 0];
  for (let node: Element | null = element; node instanceof HTMLElement; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
};

/** Where the layout puts an element's top left in the viewport, in pixels, ignoring any transforms. */
const offsetIn = (element: HTMLElement, viewport: HTMLElement): Point => {
  const [at, base] = [layoutOffset(element), layoutOffset(viewport)];
  return { x: at.x - base.x, y: at.y - base.y };
};

/** The properties placement sets, which it takes off again when it stops. */
const PLACEMENT_PROPERTIES = ["transform-origin", "translate", "scale", "z-index"];

/**
 * Places one item on the floor: its anchor becomes its `transform-origin`, so `scale` keeps it fixed, and `translate`
 * moves it from where the layout put it onto the item's floor spot. A challenge foreground item also sorts among the
 * players by its depth.
 * @returns whether it was placed
 */
const placeItem = (element: HTMLElement, view: FloorView, viewport: HTMLElement): boolean => {
  const item = parseFloorItem(element);
  if (!item) return false;
  const size = { width: viewport.clientWidth, height: viewport.clientHeight };
  setStyle(element, "transform-origin", item.anchor);
  const [originX, originY] = getComputedStyle(element).transformOrigin.split(" ").map(parseFloat);
  if (!Number.isFinite(originX) || !Number.isFinite(originY) || size.width === 0) return false;

  const at = offsetIn(element, viewport);
  const anchor = { x: at.x + originX, y: at.y + originY };
  const floor = { x: item.x ?? (100 * anchor.x) / size.width, y: item.y };
  const { translate, scale } = placeOnFloor(view, size, anchor, { floor, height: item.height });
  setStyle(element, "translate", `${translate.x.toFixed(1)}px ${translate.y.toFixed(1)}px`);
  setStyle(element, "scale", scale.toFixed(4));
  if (element.closest(`.${DEPTH_STACK_CLASS}`)) setStyle(element, "z-index", String(depthZIndex(item.y)));
  return true;
};

/** Places every floor item and draws every surface, remembering which so their styles can be taken off again. */
const placeAll = (
  viewport: HTMLElement,
  view: FloorView,
  placed: { items: Set<HTMLElement>; surfaces: Set<HTMLElement> },
) => {
  for (const element of viewport.querySelectorAll<HTMLElement>(FLOOR_ITEM_SELECTOR)) {
    if (placeItem(element, view, viewport)) placed.items.add(element);
  }
  const size = { width: viewport.clientWidth, height: viewport.clientHeight };
  if (size.width === 0 || size.height === 0) return;
  for (const element of viewport.querySelectorAll<HTMLElement>(SURFACE_SELECTOR)) {
    if (placeSurface(element, view, size, offsetIn(element, viewport))) placed.surfaces.add(element);
  }
};

/** Says once per element that `data-depth` has gone, naming what replaced it. */
const warnOfDepthItems = (viewport: HTMLElement, warned: WeakSet<Element>) => {
  for (const element of viewport.querySelectorAll("[data-depth]")) {
    if (warned.has(element)) continue;
    warned.add(element);
    console.error(
      `${element.id ? `#${element.id}: ` : ""}data-depth is no longer supported; use data-floor-y`,
      element,
    );
  }
};

/**
 * Places the scenes' floor items, and draws their floor surfaces, while a 2.5D scene shows, every frame, as reshapes and template re-renders move them
 * or rewrite their style. Elsewhere it only reports items still using `data-depth`.
 *
 * `ponytail:` the layout position is the sum of `offsetLeft`/`offsetTop`, so an item inside a wrapper with its own
 * transform is placed as if the wrapper had none; measure through the wrapper if a game needs that. Checking every
 * item every frame is O(items); observe resizes and mutations instead if that ever shows in profiles.
 * @param view the floor shown, or undefined in a 2D scene; keep it the same object while it doesn't change
 */
export function useFloorPlacement(viewportRef: RefObject<HTMLElement | null>, view: FloorView | undefined): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const placed = { items: new Set<HTMLElement>(), surfaces: new Set<HTMLElement>() };
    const warned = new WeakSet<Element>();
    let frame = 0;
    const place = () => {
      warnOfDepthItems(viewport, warned);
      if (view) placeAll(viewport, view, placed);
      frame = requestAnimationFrame(place);
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      const clear = (elements: Set<HTMLElement>, properties: string[]) =>
        elements.forEach((element) => properties.forEach((property) => element.style.removeProperty(property)));
      clear(placed.items, PLACEMENT_PROPERTIES);
      clear(placed.surfaces, SURFACE_PROPERTIES);
    };
  }, [viewportRef, view]);
}

/** Whether a floor point is on the floor. */
const onFloor = ({ x, y }: Point): boolean => x >= 0 && x <= 100 && y >= 0 && y <= 100;

/**
 * Whether no player could stand on any part of a rectangle: none of its corners or its centre is on the floor.
 * `ponytail:` five points, so a thin rectangle crossing a corner of the floor could be missed; it is a debug hint.
 * @param rect in viewport fractions
 * @param toFloor converts a viewport point to floor coordinates
 */
export const isUnreachable = ({ left, top, right, bottom }: Rect, toFloor: (point: Point) => Point): boolean =>
  ![
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: (left + right) / 2, y: (top + bottom) / 2 },
  ].some((point) => onFloor(toFloor(point)));

/** How often the debug view looks for targets no player can stand on, in milliseconds. */
const UNREACHABLE_CHECK_MS = 2000;

/** Whether a rule fires on where a player stands, so that its targets must be on the floor. */
const firesOnFeet = ({ interactions }: CameraRuleTarget): boolean =>
  interactions.some((interaction) => interaction.startsWith("foot") || interaction.startsWith("jump"));

/**
 * While debugging a 2.5D scene, warns once of each target of a foot or jump rule that isn't floor-placed and that no
 * player can stand on, as the floor narrows to the back and its back corners may be out of reach.
 */
export function useUnreachableWarnings(
  viewportRef: RefObject<HTMLElement | null>,
  { view, rules, debug }: { view: FloorView | undefined; rules: CameraRuleTarget[] | undefined; debug: boolean },
): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !view || !debug) return;
    const warned = new WeakSet<Element>();
    const check = () => {
      const box = viewport.getBoundingClientRect();
      const toFloor = (point: Point) => viewportToFloor(view, point);
      for (const rule of (rules ?? []).filter(firesOnFeet)) {
        const { scope, ruleIndex, selector } = rule;
        if (selector === undefined) continue;
        for (const element of sceneRoots(scope).flatMap((root) => Array.from(root.querySelectorAll(selector)))) {
          if (warned.has(element) || element.closest(`${FLOOR_ITEM_SELECTOR}, [${FLOOR_AREA_ATTRIBUTE}]`)) continue;
          const { left, top, right, bottom } = element.getBoundingClientRect();
          const fraction = (x: number, y: number) => ({ x: (x - box.left) / box.width, y: (y - box.top) / box.height });
          const [from, to] = [fraction(left, top), fraction(right, bottom)];
          if (!isUnreachable({ left: from.x, top: from.y, right: to.x, bottom: to.y }, toFloor)) continue;
          warned.add(element);
          console.warn(
            `${scope} › rules[${ruleIndex}].on.target: "${selector}" sits where no player can stand; give it data-floor-y`,
          );
        }
      }
    };
    check();
    const timer = setInterval(check, UNREACHABLE_CHECK_MS);
    return () => clearInterval(timer);
  }, [viewportRef, view, rules, debug]);
}
