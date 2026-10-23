import { useCallback, useEffect, useRef, useState } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import type { ResolvedCameraMode } from "../logic/CameraModeUtils";

/** How long each half of an ordinary display change takes. */
export const SCENE_FADE_MS = 1000;

/** How long the viewport takes to reshape for a camera change. */
export const CAMERA_RESHAPE_MS = 2000;

/** The scene currently on screen, and the targets it is heading towards. */
interface SceneTarget<T> {
  layers: T;
  displayKey: string;
  camera: ResolvedCameraMode;
  cameraAspectRatio: number | undefined;
}

/** The game viewport's target shape, and the shape a camera reshape starts from. */
export interface ViewportShape {
  /** The shape the viewport settles at, or undefined while it fills the container. */
  ratio: number | undefined;
  /** The shape a camera reshape animates from, while one is running. */
  from: number | undefined;
}

/** What to render for a scene, and whether it is mid-change. */
export interface SceneTransition<T> {
  /** The display layers to render now. */
  layers: T;
  /** The camera settings that belong to those layers. */
  camera: ResolvedCameraMode;
  /** The game viewport's target shape, and the shape a camera reshape starts from. */
  viewport: ViewportShape;
  /** Whether the viewport is reshaping for a camera change. */
  reshaping: boolean;
  /** 1 when visible, 0 while faded out. */
  opacity: 0 | 1;
  /** Whether a display or camera change is running, so interactions must wait. */
  transitioning: boolean;
}

/** The latest display, camera and motion preference. */
interface SceneTransitionOptions<T> {
  /** The latest display layers from the game state. */
  layers: T;
  /** Identifies the latest display, so content-only updates do not fade. */
  displayKey: string;
  /** The latest camera settings. */
  camera: ResolvedCameraMode;
  /** The shape the camera reports, once its video is playing. */
  cameraAspectRatio: number | undefined;
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
  if (latest.layers !== shown.layers || !sameCamera(latest.camera, shown.camera)) {
    run.show({ ...shown, layers: latest.layers, camera: latest.camera });
  }
  run.setViewport({ ratio: latest.camera.enabled ? latest.cameraAspectRatio : undefined, from: undefined });
};

/** Fades the shown display out, swaps to the latest scene, and fades it in. */
const fadeScene = async <T>(run: TransitionRun<T>) => {
  run.setOpacity(0);
  await wait(SCENE_FADE_MS);
  if (!run.mountedRef.current) return;
  run.show(run.latestRef.current);
  run.setOpacity(1);
  await wait(SCENE_FADE_MS);
};

/** Reshapes the viewport over two seconds, fading the display out over the final second when it changes. */
const reshapeScene = async <T>(run: TransitionRun<T>) => {
  const target = run.latestRef.current;
  const targetRatio = target.camera.enabled
    ? target.cameraAspectRatio
    : (run.measureContainer() ?? run.measureViewport());
  const startRatio = run.measureViewport() ?? targetRatio;

  run.setViewport({ ratio: targetRatio, from: startRatio });
  run.setReshaping(true);

  await wait(CAMERA_RESHAPE_MS / 2);
  if (!run.mountedRef.current) return;
  const fading = run.latestRef.current.displayKey !== run.shownRef.current.displayKey;
  if (fading) run.setOpacity(0);

  await wait(CAMERA_RESHAPE_MS / 2);
  if (!run.mountedRef.current) return;
  const swapped = run.latestRef.current;
  run.show(swapped);
  run.setReshaping(false);
  run.setViewport({ ratio: swapped.camera.enabled ? swapped.cameraAspectRatio : undefined, from: undefined });
  if (!fading) return;
  run.setOpacity(1);
  await wait(SCENE_FADE_MS);
};

/** Runs fades and reshapes until the shown scene matches the latest target. */
const runTransition = async <T>(run: TransitionRun<T>) => {
  while (run.mountedRef.current) {
    const latest = run.latestRef.current;
    const shown = run.shownRef.current;
    const displayChanged = latest.displayKey !== shown.displayKey;
    const cameraChanged = latest.camera.enabled !== shown.camera.enabled;

    if (!displayChanged && !cameraChanged) {
      syncScene(run);
      run.setTransitioning(false);
      return;
    }
    // Camera mode cannot start reshaping until the video reports a shape
    if (cameraChanged && latest.camera.enabled && !isDefined(latest.cameraAspectRatio)) {
      run.setTransitioning(false);
      return;
    }

    run.setTransitioning(true);
    if (run.reducedMotionRef.current) {
      run.show(run.latestRef.current);
      run.setViewport({ ratio: latest.camera.enabled ? latest.cameraAspectRatio : undefined, from: undefined });
      run.setOpacity(1);
      run.setReshaping(false);
      continue;
    }
    if (cameraChanged) await reshapeScene(run);
    else await fadeScene(run);
  }
};

/** The shown scene, the latest target, and the refs the transition runner needs. */
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

  return {
    shown,
    shownRef,
    latestRef,
    reducedMotionRef,
    mountedRef,
    transitioning,
    transitioningRef,
    show,
    setTransitioning,
  };
}

/**
 * Shows the current display, fading out the old one and fading in the new one when the display key
 * changes. A camera on/off change reshapes the viewport over two seconds instead, and a display that
 * changes with it fades out over the final second of the reshape before fading in. Content updates
 * within the same display pass straight through.
 */
export default function useSceneTransition<T>({
  layers,
  displayKey,
  camera,
  cameraAspectRatio,
  reducedMotion,
  measureViewport,
  measureContainer,
}: SceneTransitionOptions<T>): SceneTransition<T> {
  const {
    shown,
    shownRef,
    latestRef,
    reducedMotionRef,
    mountedRef,
    transitioning,
    transitioningRef,
    show,
    setTransitioning,
  } = useSceneTargets<T>({ layers, displayKey, camera, cameraAspectRatio }, reducedMotion);
  const [opacity, setOpacity] = useState<0 | 1>(1);
  const [reshaping, setReshaping] = useState(false);
  const [viewport, setViewport] = useState<ViewportShape>({
    ratio: camera.enabled ? cameraAspectRatio : undefined,
    from: undefined,
  });
  // Start a run whenever a target changes while nothing is running
  useEffect(() => {
    if (transitioningRef.current) return;
    void runTransition({
      latestRef,
      shownRef,
      reducedMotionRef,
      mountedRef,
      measureViewport,
      measureContainer,
      show,
      setOpacity,
      setReshaping,
      setViewport,
      setTransitioning,
    });
  }, [
    layers,
    displayKey,
    camera.enabled,
    camera.preview,
    cameraAspectRatio,
    reducedMotion,
    measureViewport,
    measureContainer,
    show,
    setTransitioning,
    latestRef,
    shownRef,
    reducedMotionRef,
    mountedRef,
    transitioningRef,
  ]);
  return { layers: shown.layers, camera: shown.camera, viewport, reshaping, opacity, transitioning };
}
