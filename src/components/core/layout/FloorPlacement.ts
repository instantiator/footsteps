import { useEffect, type RefObject } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import { placeOnFloor, type FloorView } from "../../camera/FloorGeometry";
import { DEPTH_STACK_CLASS, depthZIndex } from "../../camera/PlayerPosition";
import type { Point } from "../../../vision/VisionTypes";

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

/** A finite number from game content, or undefined. */
const numberOf = (value: string | null): number | undefined => {
  const parsed = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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

/** A band of floor y, across the whole floor. */
export interface FloorBand {
  /** Its back edge. */
  min: number;
  /** Its front edge. */
  max: number;
}

/** The band of floor y a player must stand in to interact with an element, if it is a thick floor item. */
export const floorBandOf = (element: Element): FloorBand | undefined => {
  const item = element.closest(FLOOR_ITEM_SELECTOR);
  const floor = item === null ? null : parseFloorItem(item);
  if (!isDefined(floor?.thickness)) return undefined;
  return { min: floor.y - floor.thickness / 2, max: floor.y + floor.thickness / 2 };
};

/** Where the layout puts an element's top left, in page pixels, ignoring any transforms. */
const layoutOffset = (element: HTMLElement): Point => {
  let [x, y] = [0, 0];
  for (let node: Element | null = element; node instanceof HTMLElement; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
};

/** Sets an inline style property, only if it changes, so an unchanged item costs no style work. */
const setStyle = (element: HTMLElement, property: string, value: string) => {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
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

  const [at, base] = [layoutOffset(element), layoutOffset(viewport)];
  const anchor = { x: at.x - base.x + originX, y: at.y - base.y + originY };
  const floor = { x: item.x ?? (100 * anchor.x) / size.width, y: item.y };
  const { translate, scale } = placeOnFloor(view, size, anchor, { floor, height: item.height });
  setStyle(element, "translate", `${translate.x.toFixed(1)}px ${translate.y.toFixed(1)}px`);
  setStyle(element, "scale", scale.toFixed(4));
  if (element.closest(`.${DEPTH_STACK_CLASS}`)) setStyle(element, "z-index", String(depthZIndex(item.y)));
  return true;
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
 * Places the scenes' floor items while a 2.5D scene shows, every frame, as reshapes and template re-renders move them
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
    const placed = new Set<HTMLElement>();
    const warned = new WeakSet<Element>();
    let frame = 0;
    const place = () => {
      warnOfDepthItems(viewport, warned);
      if (view) {
        for (const element of viewport.querySelectorAll<HTMLElement>(FLOOR_ITEM_SELECTOR)) {
          if (placeItem(element, view, viewport)) placed.add(element);
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      for (const element of placed) PLACEMENT_PROPERTIES.forEach((property) => element.style.removeProperty(property));
    };
  }, [viewportRef, view]);
}
