import { useCallback, useContext, useEffect, useRef, type RefObject } from "react";
import type { SceneScope } from "../../../entities/state/GameState";
import useAppConfig from "../../../providers/AppConfigHook";
import { PlayerRegistryContext } from "../../../providers/PlayerRegistryContext";
import type { PlayerRegistry } from "../../camera/PlayerRegistry";
import {
  EMPTY_MASK_RECT,
  maskPointForScreenPoint,
  maskRectForElement,
  screenPointForMaskPoint,
} from "../../camera/FloorGeometry";
import { jumpSettingsOf } from "../../camera/JumpDetector";
import {
  PlayerMonitor,
  type CameraInteraction,
  type MonitorTarget,
  type PlayerFrame,
  type PlayerMonitorEvent,
} from "../../camera/PlayerMonitor";
import { centreOnScreen } from "../effects/EffectTargets";
import { floorBandOf, type FloorBand } from "./FloorPlacement";
import { sceneRoots } from "../logic/TemplateUtils";

/** A rule the camera can fire: which scene it belongs to, and the elements and interactions it watches. */
export interface CameraRuleTarget {
  /** The scene the rule belongs to. */
  scope: SceneScope;
  /** Which run of the scene this is. */
  run: number;
  /** The rule's position in the scene's rules. */
  ruleIndex: number;
  /** CSS selector for the elements, run inside the scene's templates every frame; none for a jump anywhere. */
  selector: string | undefined;
  /** The camera interactions that fire the rule. */
  interactions: CameraInteraction[];
  /** The fraction of the body part that must be inside the element (0–1). */
  threshold: number;
  /** Whether the element counts even where something else covers it. */
  includeCovered: boolean;
  /** How long, in milliseconds, a body part must stay over the element before it enters. */
  holdMs: number;
  /** For being near: how close counts, as a % of the scene's width. */
  within?: number;
}

/** A camera interaction with an element a rule watches. */
export interface CameraRuleEvent {
  /** The scene the rule belongs to. */
  scope: SceneScope;
  /** The rule's position in the scene's rules. */
  ruleIndex: number;
  /** The element the player interacted with; null for a jump anywhere. */
  element: Element | null;
  /** What the player did. */
  interaction: CameraInteraction;
  /** The number of the player who did it. */
  player: number;
}

/** Generated keys for elements without an `id`, dropped with the element. */
const generatedKeys = new WeakMap<Element, string>();
let nextGeneratedKey = 0;

/**
 * A key for an element that stays the same while the element does, so the monitors remember interactions with it
 * between frames: its `id`, or a generated key. (An element without an `id` that a re-render replaces gets a new
 * key, and so counts as new.)
 */
export const elementKey = (element: Element): string => {
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
  sources: Map<string, Omit<CameraRuleEvent, "interaction" | "player">>;
  /** The band of floor a player must stand in for each thick floor item's key; only in a 2.5D scene. */
  bands: Map<string, FloorBand>;
}

/** What a monitor reads as it reports: the latest sources, handler and settings. */
interface MonitorRefs {
  sourcesRef: RefObject<FrameTargets["sources"]>;
  callbackRef: RefObject<((event: CameraRuleEvent) => void) | undefined>;
  stableFramesRef: RefObject<number>;
  jumpRef: RefObject<ReturnType<typeof jumpSettingsOf>>;
}

/** Makes a player's monitor, which reports each interaction as the rule and element behind it, from that player. */
const monitorMaker =
  (registry: PlayerRegistry, { sourcesRef, callbackRef, stableFramesRef, jumpRef }: MonitorRefs) =>
  (player: PlayerFrame): PlayerMonitor => {
    // Their number is read now, as it may be free again by the time they are released
    const number = registry.numberOf(player.id) ?? 0;
    const report = (event: PlayerMonitorEvent) => {
      const source = sourcesRef.current.get(event.key);
      if (source) callbackRef.current?.({ ...source, interaction: event.interaction, player: number });
    };
    return new PlayerMonitor(report, stableFramesRef.current, jumpRef.current);
  };

/** A frame with no targets, keeping the given sources, so players who have gone can report what they left. */
const noTargets = (sources: FrameTargets["sources"]): FrameTargets => ({ targets: {}, sources, bands: new Map() });

/**
 * The targets as one player can reach them: a thick floor item is out of reach unless they stand in its band, so
 * it counts as having nothing over it, and whatever they had entered they leave.
 */
export const targetsInReach = (
  { targets, bands }: Pick<FrameTargets, "targets" | "bands">,
  position: PlayerFrame["position"],
): Record<string, MonitorTarget> => {
  if (bands.size === 0) return targets;
  const reachable = { ...targets };
  for (const [key, { min, max }] of bands) {
    const inBand = position !== null && position.y >= min && position.y <= max;
    if (!inBand) reachable[key] = { ...targets[key], rect: EMPTY_MASK_RECT, near: undefined };
  }
  return reachable;
};

/** How being near an element reads in mask pixels. Its centre may be off the mask, unlike its bounds. */
const nearTarget = (
  element: Element,
  within: number,
  canvas: HTMLCanvasElement,
  { mask, mirrored }: { mask: PlayerFrame; mirrored: boolean },
): MonitorTarget["near"] => {
  const canvasRect = canvas.getBoundingClientRect();
  const sceneWidth = canvas.closest(".gameViewport")?.getBoundingClientRect().width ?? canvasRect.width;
  return {
    centre: maskPointForScreenPoint(centreOnScreen(element), canvasRect, mask, mirrored),
    within: ((within / 100) * sceneWidth * mask.width) / canvasRect.width,
  };
};

/**
 * The elements the camera rules watch, found by their selectors in the scenes shown now, as mask-space targets.
 * Elements can come, go and move between frames.
 */
const frameTargets = (
  canvas: HTMLCanvasElement,
  players: PlayerFrame[],
  rules: CameraRuleTarget[],
  { mirrored, onFloor }: { mirrored: boolean; onFloor: boolean },
): FrameTargets => {
  const canvasRect = canvas.getBoundingClientRect();
  const [mask] = players;
  const result: FrameTargets = { targets: {}, sources: new Map(), bands: new Map() };
  for (const rule of rules) {
    if (rule.selector === undefined) {
      const key = `${rule.scope}#${rule.ruleIndex}#anywhere`;
      result.targets[key] = { rect: EMPTY_MASK_RECT, interactions: rule.interactions, threshold: 0, anywhere: true };
      result.sources.set(key, { scope: rule.scope, ruleIndex: rule.ruleIndex, element: null });
      continue;
    }
    const selector = rule.selector;
    for (const element of sceneRoots(rule.scope).flatMap((root) => Array.from(root.querySelectorAll(selector)))) {
      const key = `${rule.scope}#${rule.ruleIndex}#${elementKey(element)}`;
      const isTopmostAt = (point: { x: number; y: number }) => {
        const { x, y } = screenPointForMaskPoint(point, canvasRect, mask, mirrored);
        const hit = document.elementFromPoint(x, y);
        return hit !== null && element.contains(hit);
      };
      result.targets[key] = {
        rect: maskRectForElement(element.getBoundingClientRect(), canvasRect, mask, mirrored),
        interactions: rule.interactions,
        threshold: rule.threshold,
        holdMs: rule.holdMs,
        isTopmostAt: rule.includeCovered ? undefined : isTopmostAt,
        ...(rule.within !== undefined && { near: nearTarget(element, rule.within, canvas, { mask, mirrored }) }),
      };
      result.sources.set(key, { scope: rule.scope, ruleIndex: rule.ruleIndex, element });
      const band = onFloor ? floorBandOf(element) : undefined;
      if (band) result.bands.set(key, band);
    }
  }
  return result;
};

/**
 * Gives each player's frame to their monitor, making monitors for new players and releasing those of players gone.
 * A held player is only drawn: their monitor waits, keeping any jump in progress, for them to be found again.
 */
const updateMonitors = (
  monitors: Map<number, PlayerMonitor>,
  players: PlayerFrame[],
  update: (monitor: PlayerMonitor, player: PlayerFrame) => void,
  createMonitor: (player: PlayerFrame) => PlayerMonitor,
): void => {
  for (const player of players) {
    if (player.held) continue;
    let monitor = monitors.get(player.id);
    if (!monitor) monitors.set(player.id, (monitor = createMonitor(player)));
    update(monitor, player);
  }
  const seen = new Set(players.map((player) => player.id));
  for (const [playerId, monitor] of Array.from(monitors)) {
    if (seen.has(playerId)) continue;
    monitor.release(); // they have gone, so they have left whatever they were in
    monitors.delete(playerId);
  }
};

/** Rearms the monitors for a scene that has reset: whoever is already over its elements must move into them again. */
function useRearmOnReset(
  cameraRules: CameraRuleTarget[] | undefined,
  monitorsRef: RefObject<Map<number, PlayerMonitor>>,
) {
  const runsRef = useRef(new Map<SceneScope, number>());
  useEffect(() => {
    const runs = new Map((cameraRules ?? []).map(({ scope, run }) => [scope, run]));
    for (const [scope, run] of runs) {
      const before = runsRef.current.get(scope);
      if (before !== undefined && before !== run) monitorsRef.current.forEach((monitor) => monitor.rearm(`${scope}#`));
    }
    runsRef.current = runs;
  }, [cameraRules, monitorsRef]);
}

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
 * @param cameraRules the rules the camera can fire, for the scenes shown now
 * @param onPlayerInteraction called for each interaction that begins
 * @param enabled whether interactions are running; switching it off clears the monitors
 * @param scene whether the character canvas shows the mask flipped (`mirrored`, fixed for the hook's lifetime), and
 * whether a 2.5D scene shows (`onFloor`), where thick floor items only count from inside their band
 * @returns the character canvas's ref, and the stable frame handler to give it
 */
export function usePlayerInteractions(
  cameraRules: CameraRuleTarget[] | undefined,
  onPlayerInteraction: ((event: CameraRuleEvent) => void) | undefined,
  enabled: boolean,
  { mirrored, onFloor = false }: { mirrored: boolean; onFloor?: boolean },
): PlayerInteractions {
  const config = useAppConfig();
  const registry = useContext(PlayerRegistryContext);
  const stableFrames = config.visionSmoothing ? config.visionStableFrames : 1;
  const stableFramesRef = useRef(stableFrames);
  const jumpRef = useRef(jumpSettingsOf(config));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monitorsRef = useRef(new Map<number, PlayerMonitor>());
  const rulesRef = useRef(cameraRules);
  const sourcesRef = useRef<FrameTargets["sources"]>(new Map());
  const callbackRef = useRef(onPlayerInteraction);
  const enabledRef = useRef(enabled);
  const onFloorRef = useRef(onFloor);

  useRearmOnReset(cameraRules, monitorsRef);

  useEffect(() => {
    rulesRef.current = cameraRules;
    callbackRef.current = onPlayerInteraction;
    onFloorRef.current = onFloor;
  }, [cameraRules, onPlayerInteraction, onFloor]);

  useEffect(() => {
    stableFramesRef.current = stableFrames;
    jumpRef.current = jumpSettingsOf(config);
  }, [stableFrames, config]);

  // Interactions pause during scene changes; fresh monitors afterwards ignore whatever already holds
  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) monitorsRef.current.clear();
  }, [enabled]);

  const handlePlayers = useCallback(
    (players: PlayerFrame[], timestamp: number) => {
      const canvas = canvasRef.current;
      const monitors = monitorsRef.current;
      // While interactions pause nothing has been left, so the monitors are dropped without releasing them
      if (!enabledRef.current || !canvas || !callbackRef.current) {
        monitors.clear();
        return;
      }

      const scene = { mirrored, onFloor: onFloorRef.current };
      const frame =
        players.length > 0
          ? frameTargets(canvas, players, rulesRef.current ?? [], scene)
          : noTargets(sourcesRef.current);
      sourcesRef.current = frame.sources;
      const createMonitor = monitorMaker(registry, { sourcesRef, callbackRef, stableFramesRef, jumpRef });
      const update = (monitor: PlayerMonitor, player: PlayerFrame) =>
        monitor.update(player, targetsInReach(frame, player.position), timestamp);
      updateMonitors(monitors, players, update, createMonitor);
    },
    [canvasRef, mirrored, registry],
  );

  return { canvasRef, handlePlayers };
}
