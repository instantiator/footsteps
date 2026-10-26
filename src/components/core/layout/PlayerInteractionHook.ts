import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { DisplayScope } from "../../../entities/state/GameState";
import useAppConfig from "../../../providers/AppConfigHook";
import { maskRectForElement, screenPointForMaskPoint } from "../../camera/CameraSupport";
import {
  PlayerMonitor,
  type CameraInteraction,
  type MonitorTarget,
  type PlayerFrame,
  type PlayerMonitorEvent,
} from "../../camera/PlayerMonitor";
import { displayRoots } from "../logic/TemplateUtils";

/** A rule the camera can fire: which display it belongs to, and the elements and interactions it watches. */
export interface CameraRuleTarget {
  /** The display the rule belongs to. */
  scope: DisplayScope;
  /** The rule's position in the display's rules. */
  ruleIndex: number;
  /** CSS selector for the elements, run inside the display's templates every frame. */
  selector: string;
  /** The camera interactions that fire the rule. */
  interactions: CameraInteraction[];
  /** The fraction of the body part that must be inside the element (0–1). */
  threshold: number;
  /** Whether the element counts even where something else covers it. */
  includeCovered: boolean;
}

/** A camera interaction with an element a rule watches. */
export interface CameraRuleEvent {
  /** The display the rule belongs to. */
  scope: DisplayScope;
  /** The rule's position in the display's rules. */
  ruleIndex: number;
  /** The element the player interacted with. */
  element: Element;
  /** What the player did. */
  interaction: CameraInteraction;
}

/** Generated keys for elements without an `id`, dropped with the element. */
const generatedKeys = new WeakMap<Element, string>();
let nextGeneratedKey = 0;

/**
 * A key for an element that stays the same while the element does, so the monitors remember interactions with it
 * between frames: its `id`, or a generated key. (An element without an `id` that a re-render replaces gets a new
 * key, and so counts as new.)
 */
const elementKey = (element: Element): string => {
  if (element.id) return `id:${element.id}`;
  let key = generatedKeys.get(element);
  if (key === undefined) generatedKeys.set(element, (key = `el:${nextGeneratedKey++}`));
  return key;
};

/** This frame's targets, by key, and which rule and element each key stands for. */
interface FrameTargets {
  /** What the monitors check, by key. */
  targets: Record<string, MonitorTarget>;
  /** The rule and element behind each key. */
  sources: Map<string, Omit<CameraRuleEvent, "interaction">>;
}

/**
 * The elements the camera rules watch, found by their selectors in the displays shown now, as mask-space targets.
 * Elements can come, go and move between frames.
 */
const frameTargets = (canvas: HTMLCanvasElement, players: PlayerFrame[], rules: CameraRuleTarget[]): FrameTargets => {
  const canvasRect = canvas.getBoundingClientRect();
  const { width, height } = players[0];
  const result: FrameTargets = { targets: {}, sources: new Map() };
  for (const rule of rules) {
    for (const element of displayRoots(rule.scope).flatMap((root) =>
      Array.from(root.querySelectorAll(rule.selector)),
    )) {
      const key = `${rule.scope}#${rule.ruleIndex}#${elementKey(element)}`;
      const isTopmostAt = (point: { x: number; y: number }) => {
        const { x, y } = screenPointForMaskPoint(point, canvasRect, width, height);
        const hit = document.elementFromPoint(x, y);
        return hit !== null && element.contains(hit);
      };
      result.targets[key] = {
        rect: maskRectForElement(element.getBoundingClientRect(), canvasRect, width, height),
        interactions: rule.interactions,
        threshold: rule.threshold,
        isTopmostAt: rule.includeCovered ? undefined : isTopmostAt,
      };
      result.sources.set(key, { scope: rule.scope, ruleIndex: rule.ruleIndex, element });
    }
  }
  return result;
};

/** What {@link usePlayerInteractions} gives the layout. */
interface PlayerInteractions {
  /** The character canvas's element, for converting screen bounds into mask pixels. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The stable frame handler to give the character canvas. */
  handlePlayers: (players: PlayerFrame[], timestamp: number) => void;
}

/**
 * Feeds each camera frame to one monitor per player, turning body parts into interactions with
 * the elements the camera rules watch.
 *
 * The returned frame handler never changes: the character canvas restarts segmentation whenever its
 * callbacks change, so the latest targets and event handler are read from refs instead.
 *
 * @param cameraRules the rules the camera can fire, for the displays shown now
 * @param onPlayerInteraction called for each interaction that begins
 * @param enabled whether interactions are running; switching it off clears the monitors
 * @returns the character canvas's ref, and the stable frame handler to give it
 */
export function usePlayerInteractions(
  cameraRules: CameraRuleTarget[] | undefined,
  onPlayerInteraction: ((event: CameraRuleEvent) => void) | undefined,
  enabled: boolean,
): PlayerInteractions {
  const { visionSmoothing, visionStableFrames } = useAppConfig();
  const stableFrames = visionSmoothing ? visionStableFrames : 1;
  const stableFramesRef = useRef(stableFrames);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monitorsRef = useRef(new Map<number, PlayerMonitor>());
  const rulesRef = useRef(cameraRules);
  const sourcesRef = useRef<FrameTargets["sources"]>(new Map());
  const callbackRef = useRef(onPlayerInteraction);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    rulesRef.current = cameraRules;
  }, [cameraRules]);

  useEffect(() => {
    callbackRef.current = onPlayerInteraction;
  }, [onPlayerInteraction]);

  useEffect(() => {
    stableFramesRef.current = stableFrames;
  }, [stableFrames]);

  // Interactions pause during display changes; fresh monitors afterwards ignore whatever already holds
  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) monitorsRef.current.clear();
  }, [enabled]);

  const handlePlayers = useCallback(
    (players: PlayerFrame[], timestamp: number) => {
      const canvas = canvasRef.current;
      const emit = callbackRef.current;
      const monitors = monitorsRef.current;
      if (!enabledRef.current || !canvas || !emit || players.length === 0) {
        monitors.clear();
        return;
      }

      const { targets, sources } = frameTargets(canvas, players, rulesRef.current ?? []);
      sourcesRef.current = sources;
      const seen = new Set<number>();
      for (const player of players) {
        seen.add(player.id);
        let monitor = monitors.get(player.id);
        if (!monitor) {
          monitor = new PlayerMonitor((event: PlayerMonitorEvent) => {
            const source = sourcesRef.current.get(event.key);
            if (source) callbackRef.current?.({ ...source, interaction: event.interaction });
          }, stableFramesRef.current);
          monitors.set(player.id, monitor);
        }
        monitor.update(player, targets, timestamp);
      }
      for (const playerId of Array.from(monitors.keys())) {
        if (!seen.has(playerId)) monitors.delete(playerId);
      }
    },
    [canvasRef],
  );

  return { canvasRef, handlePlayers };
}
