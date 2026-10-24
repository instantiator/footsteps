import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  DEFAULT_INTERACTIONS,
  DEFAULT_INTERACTION_THRESHOLD,
  type GameInteractionTarget,
} from "../../../entities/data/displays/GameDisplayData";
import { maskRectForElement } from "../../camera/CameraSupport";
import {
  PlayerMonitor,
  type MonitorTarget,
  type PlayerFrame,
  type PlayerMonitorEvent,
} from "../../camera/PlayerMonitor";

/** The current players, as mask-space targets for each configured element that is on screen. */
const monitorTargets = (
  canvas: HTMLCanvasElement,
  players: PlayerFrame[],
  interactionTargets: Record<string, GameInteractionTarget>,
): Record<string, MonitorTarget> => {
  const canvasRect = canvas.getBoundingClientRect();
  const { width, height } = players[0].mask;
  const targets: Record<string, MonitorTarget> = {};
  for (const [elementId, target] of Object.entries(interactionTargets)) {
    const element = document.getElementById(elementId);
    if (!element) continue; // the display that the target belongs to is not the one on screen
    targets[elementId] = {
      rect: maskRectForElement(element.getBoundingClientRect(), canvasRect, width, height),
      interactions: target.interactions ?? DEFAULT_INTERACTIONS,
      threshold: target.threshold ?? DEFAULT_INTERACTION_THRESHOLD,
    };
  }
  return targets;
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
 * the elements currently on screen.
 *
 * The returned frame handler never changes: the character canvas restarts segmentation whenever its
 * callbacks change, so the latest targets and event handler are read from refs instead.
 *
 * @param interactionTargets the elements the camera can interact with, by element id
 * @param onPlayerInteraction called for each interaction that begins
 * @param enabled whether interactions are running; switching it off clears the monitors
 * @returns the character canvas's ref, and the stable frame handler to give it
 */
export function usePlayerInteractions(
  interactionTargets: Record<string, GameInteractionTarget> | undefined,
  onPlayerInteraction: ((event: PlayerMonitorEvent) => void) | undefined,
  enabled: boolean,
): PlayerInteractions {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monitorsRef = useRef(new Map<number, PlayerMonitor>());
  const targetsRef = useRef(interactionTargets);
  const callbackRef = useRef(onPlayerInteraction);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    targetsRef.current = interactionTargets;
  }, [interactionTargets]);

  useEffect(() => {
    callbackRef.current = onPlayerInteraction;
  }, [onPlayerInteraction]);

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

      const targets = monitorTargets(canvas, players, targetsRef.current ?? {});
      const seen = new Set<number>();
      for (const player of players) {
        seen.add(player.id);
        let monitor = monitors.get(player.id);
        if (!monitor) {
          monitor = new PlayerMonitor((event) => callbackRef.current?.(event));
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
