import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameSceneMode } from "../../../entities/data/scenes/GameSceneData";
import type { ResolvedCameraMode } from "../logic/AvatarModeUtils";

/** How long each half of an ordinary scene change takes. */
export const SCENE_FADE_MS = 1000;

/** How long the viewport takes to reshape for a change of shape. */
export const CAMERA_RESHAPE_MS = 2000;

/**
 * The shape the viewport takes: a width-to-height ratio, `fill` to fill its container, or undefined while it waits
 * for a camera that has not yet reported its shape.
 */
export type ViewportTarget = number | "fill" | undefined;

/** The scene currently on screen, and the targets it is heading towards. */
interface SceneTarget<T> {
  layers: T;
  sceneKey: string;
  camera: ResolvedCameraMode;
  sceneMode: GameSceneMode;
  shape: ViewportTarget;
}

/** The ratio the viewport's style takes for a shape: none while it fills its container or the shape is unknown. */
const ratioOf = (shape: ViewportTarget): number | undefined => (shape === "fill" ? undefined : shape);

/** The game viewport's target shape, and the shape a camera reshape starts from. */
export interface ViewportShape {
  /** The shape the viewport settles at, or undefined while it fills the container. */
  ratio: number | undefined;
  /** The shape a reshape animates from, while one is running. */
  from: number | undefined;
}

/** What to render for a scene, and whether it is mid-change. */
export interface SceneTransition<T> {
  /** The scene layers to render now. */
  layers: T;
  /** The camera settings that belong to those layers. */
  camera: ResolvedCameraMode;
  /** How those layers are laid out. */
  sceneMode: GameSceneMode;
  /** The game viewport's target shape, and the shape a reshape starts from. */
  viewport: ViewportShape;
  /** Whether the viewport is reshaping. */
  reshaping: boolean;
  /** 1 when visible, 0 while faded out. */
  opacity: 0 | 1;
  /** Whether a scene or camera change is running, so interactions must wait. */
  transitioning: boolean;
}

/** The latest scene, camera and motion preference. */
interface SceneTransitionOptions<T> {
  /** The latest scene layers from the game state. */
  layers: T;
  /** Identifies the latest scene, so content-only updates do not fade. */
  sceneKey: string;
  /** The latest camera settings. */
  camera: ResolvedCameraMode;
  /** How the latest scene is laid out. */
  sceneMode: GameSceneMode;
  /** The shape the latest scene needs the viewport to take. */
  shape: ViewportTarget;
  /** Skip the waits when the player prefers reduced motion. */
  reducedMotion: boolean;
  /** Measures the viewport's current width-to-height ratio, if it has a size. */
  measureViewport: () => number | undefined;
  /** Measures the container's width-to-height ratio, if it has a size. */
  measureContainer: () => number | undefined;
}

/** The state an asynchronous transition reads and updates. */
interface TransitionRun<T> {
  latestRef: { current: SceneTarget<T> };
  shownRef: { current: SceneTarget<T> };
  reducedMotionRef: { current: boolean };
  mountedRef: { current: boolean };
  measureViewport: () => number | undefined;
  measureContainer: () => number | undefined;
  show: (scene: SceneTarget<T>) => void;
  setOpacity: (opacity: 0 | 1) => void;
  setReshaping: (reshaping: boolean) => void;
  setViewport: (viewport: ViewportShape) => void;
  setTransitioning: (transitioning: boolean) => void;
}

/** Resolves after the given number of milliseconds. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether two camera settings would look the same. */
const sameCamera = (a: ResolvedCameraMode, b: ResolvedCameraMode) => a.enabled === b.enabled && a.preview === b.preview;

/** Keeps the shown scene in step with a target when no transition is needed. */
const syncScene = <T>(run: TransitionRun<T>) => {
  const latest = run.latestRef.current;
  const shown = run.shownRef.current;
  if (
    latest.layers !== shown.layers ||
    !sameCamera(latest.camera, shown.camera) ||
    latest.sceneMode !== shown.sceneMode ||
    latest.shape !== shown.shape
  ) {
    run.show({
      ...shown,
      layers: latest.layers,
      camera: latest.camera,
      sceneMode: latest.sceneMode,
      shape: latest.shape,
    });
  }
  run.setViewport({ ratio: ratioOf(latest.shape), from: undefined });
};

/** Fades the shown scene out, swaps to the latest scene, and fades it in. */
const fadeScene = async <T>(run: TransitionRun<T>) => {
  run.setOpacity(0);
  await wait(SCENE_FADE_MS);
  if (!run.mountedRef.current) return;
  run.show(run.latestRef.current);
  run.setOpacity(1);
  await wait(SCENE_FADE_MS);
};

/** Reshapes the viewport over two seconds, fading the scene out over the final second when it changes. */
const reshapeScene = async <T>(run: TransitionRun<T>) => {
  const target = run.latestRef.current;
  const targetRatio = target.shape === "fill" ? (run.measureContainer() ?? run.measureViewport()) : target.shape;
  const startRatio = run.measureViewport() ?? targetRatio;

  run.setViewport({ ratio: targetRatio, from: startRatio });
  run.setReshaping(true);

  await wait(CAMERA_RESHAPE_MS / 2);
  if (!run.mountedRef.current) return;
  const fading = run.latestRef.current.sceneKey !== run.shownRef.current.sceneKey;
  if (fading) run.setOpacity(0);

  await wait(CAMERA_RESHAPE_MS / 2);
  if (!run.mountedRef.current) return;
  const swapped = run.latestRef.current;
  run.show(swapped);
  run.setReshaping(false);
  run.setViewport({ ratio: ratioOf(swapped.shape), from: undefined });
  if (!fading) return;
  run.setOpacity(1);
  await wait(SCENE_FADE_MS);
};

/** Runs fades and reshapes until the shown scene matches the latest target. */
const runTransition = async <T>(run: TransitionRun<T>) => {
  while (run.mountedRef.current) {
    const latest = run.latestRef.current;
    const shown = run.shownRef.current;
    const sceneChanged = latest.sceneKey !== shown.sceneKey;
    // A shape only reshapes from a known one: a camera reporting its first shape just settles there
    const shapeChanged = isDefined(shown.shape) && latest.shape !== shown.shape;

    if (!sceneChanged && !shapeChanged) {
      syncScene(run);
      run.setTransitioning(false);
      return;
    }
    // A camera turning on cannot start reshaping until its video reports a shape
    if (shapeChanged && !isDefined(latest.shape)) {
      run.setTransitioning(false);
      return;
    }

    run.setTransitioning(true);
    if (run.reducedMotionRef.current) {
      run.show(run.latestRef.current);
      run.setViewport({ ratio: ratioOf(latest.shape), from: undefined });
      run.setOpacity(1);
      run.setReshaping(false);
      continue;
    }
    if (shapeChanged) await reshapeScene(run);
    else await fadeScene(run);
  }
};

/** The shown scene, whether a transition is running, and the refs and callbacks the transition runner needs. */
function useSceneTargets<T>(target: SceneTarget<T>, reducedMotion: boolean) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const latestRef = useRef(target);
  const reducedMotionRef = useRef(reducedMotion);
  const mountedRef = useRef(true);
  const [transitioning, setTransitioningState] = useState(false);
  const transitioningRef = useRef(false);

  // Let the asynchronous transition read current values without restarting on every game update
  useEffect(() => {
    latestRef.current = target;
    reducedMotionRef.current = reducedMotion;
  });

  // Only unmounting stops a transition; a newer target is picked up at the next step
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const show = useCallback((next: SceneTarget<T>) => {
    shownRef.current = next;
    setShown(next);
  }, []);

  const setTransitioning = useCallback((next: boolean) => {
    transitioningRef.current = next;
    setTransitioningState(next);
  }, []);

  // The refs never change and the callbacks are stable, so this is made once
  const run = useMemo(
    () => ({ shownRef, latestRef, reducedMotionRef, mountedRef, show, setTransitioning }),
    [show, setTransitioning],
  );
  return { shown, transitioning, transitioningRef, run };
}

/**
 * Shows the current scene, fading out the old one and fading in the new one when the scene key
 * changes. A change of the viewport's shape (the camera turning on or off, or a change between 2D and 2.5D)
 * reshapes it over two seconds instead, and a scene that changes with it fades out over the final second of the
 * reshape before fading in. Content updates within the same scene pass straight through.
 */
export default function useSceneTransition<T>({
  reducedMotion,
  measureViewport,
  measureContainer,
  ...target
}: SceneTransitionOptions<T>): SceneTransition<T> {
  const { shown, transitioning, transitioningRef, run } = useSceneTargets<T>(target, reducedMotion);
  const [opacity, setOpacity] = useState<0 | 1>(1);
  const [reshaping, setReshaping] = useState(false);
  const [viewport, setViewport] = useState<ViewportShape>({ ratio: ratioOf(target.shape), from: undefined });
  // Start a run whenever a target changes while nothing is running
  useEffect(() => {
    if (transitioningRef.current) return;
    void runTransition({ ...run, measureViewport, measureContainer, setOpacity, setReshaping, setViewport });
  }, [
    target.layers,
    target.sceneKey,
    target.camera.enabled,
    target.camera.preview,
    target.sceneMode,
    target.shape,
    reducedMotion,
    measureViewport,
    measureContainer,
    run,
    transitioningRef,
  ]);
  return {
    layers: shown.layers,
    camera: shown.camera,
    sceneMode: shown.sceneMode,
    viewport,
    reshaping,
    opacity,
    transitioning,
  };
}
