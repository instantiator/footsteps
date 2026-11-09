import { useMediaQuery } from "@uidotdev/usehooks";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { isDefined } from "../../../util/ObjectUtils";
import type { GameSceneMode } from "../../../entities/data/scenes/GameSceneData";
import { loadCameraChoice } from "../../camera/CameraChoice";
import { calibrationOrDefault, cameraKeyOf } from "../../camera/FloorCalibration";
import {
  ASSUMED_IMAGE_ASPECT,
  cropAspect,
  cropPlacement,
  DEFAULT_CORNERS,
  floorCrop,
  type Corners,
  type FloorView,
} from "../../camera/FloorGeometry";
import { DEPTH_STACK_CLASS, UNSORTED_PLAYER_Z_INDEX } from "../../camera/PlayerPosition";
import type { PlayerFrame } from "../../camera/PlayerMonitor";
import { cameraModeOf, type ResolvedAvatarMode, type ResolvedCameraMode } from "../logic/AvatarModeUtils";
import "./GameLayersLayout.css";
import {
  CharacterCameraLayerWrapper,
  CharacterCanvasLayerWrapper,
  DebugLayerWrapper,
  GameLayerWrapper,
  HudLayerWrapper,
} from "./GameLayerWrappers";
import { usePlayerInteractions, type CameraRuleEvent, type CameraRuleTarget } from "./PlayerInteractionHook";
import { useMouseFeet } from "./MouseFeetHook";
import { useFloorPlacement } from "./FloorPlacement";
import useSceneTransition, { type SceneTransition, type ViewportTarget } from "./useSceneTransition";

/** Props for {@link GameLayersLayout}. */
interface GameLayersLayoutProps {
  /** The nodes to show in each scene layer. */
  gameLayers?: GameLayers;
  /** Identifies the scene these layers belong to, so a cut to another scene can fade. */
  sceneKey?: string;
  /** The game's avatar settings, already resolved for the scenes currently shown. */
  avatar: ResolvedAvatarMode;
  /** How the scenes currently shown are laid out; `2D` if not given. */
  sceneMode?: GameSceneMode;
  /** Shows the debug overlay and the camera's colour key. */
  debug?: boolean;
  /** Switches the debug aids on or off, from the HUD. */
  onToggleDebug?: () => void;
  /** The rules the camera can fire, for the scenes shown now. */
  cameraRules?: CameraRuleTarget[];
  /** Called when a player interacts with an element a camera rule watches. */
  onPlayerInteraction?: (event: CameraRuleEvent) => void;
}

/** The nodes for the background and foreground of the overview, the stage, and its challenges. */
export interface GameLayers {
  /** The overview scene, when no stage is open. */
  overview?: {
    /** The background half of the scene. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
  /** The open stage's shared scene. */
  stage?: {
    /** The background half of the scene. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
  /** The active challenges' scenes, one node per challenge. */
  challenges?: {
    /** The background half of the scene. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
}

/** The given element's width-to-height ratio, if it has a size. */
const aspectRatioOf = (element: Element | null | undefined): number | undefined => {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect.width / rect.height : undefined;
};

/**
 * The shape the viewport takes: a 2.5D scene's is the floor's crop of the camera image (the default floor on a
 * typical webcam's image without a camera); a 2D scene's is the camera's, or the container's without one.
 */
const viewportShapeOf = (
  sceneMode: GameSceneMode,
  camera: ResolvedCameraMode,
  cameraAspectRatio: number | undefined,
  calibrated: Corners,
): ViewportTarget => {
  if (sceneMode === "2.5D") {
    if (!camera.enabled) return cropAspect(floorCrop(DEFAULT_CORNERS), ASSUMED_IMAGE_ASPECT);
    return isDefined(cameraAspectRatio) ? cropAspect(floorCrop(calibrated), cameraAspectRatio) : undefined;
  }
  return camera.enabled ? cameraAspectRatio : "fill";
};

/** Props for the groups of scene layers. */
interface SceneLayersProps {
  layers: GameLayers;
}

/** The overview, stage, and challenge background layers, which sit beneath the camera character. */
function LowerSceneLayers({ layers: { overview, stage, challenges } }: SceneLayersProps) {
  return (
    <>
      <GameLayerWrapper zIndex={1} nodes={[overview?.backgroundLayerNodes]} layer="overview" layerHint="background" />
      <GameLayerWrapper zIndex={2} nodes={[overview?.foregroundLayerNodes]} layer="overview" layerHint="foreground" />
      <GameLayerWrapper zIndex={3} nodes={[stage?.backgroundLayerNodes]} layer="stage" layerHint="background" />
      <GameLayerWrapper zIndex={4} nodes={[stage?.foregroundLayerNodes]} layer="stage" layerHint="foreground" />
      <GameLayerWrapper zIndex={5} nodes={challenges?.backgroundLayerNodes} layer="challenges" layerHint="background" />
    </>
  );
}

/** The webcam's video and stream, forgotten when no camera remains mounted so re-enabling starts fresh. */
function useCameraMedia(cameraEnabled: boolean) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [characterStream, setCharacterStream] = useState<MediaStream | undefined>(undefined);

  // The camera stops its stream's tracks when it unmounts, so keep no reference to them
  // (see the React note on adjusting state when a prop changes)
  const [wasCameraEnabled, setWasCameraEnabled] = useState(cameraEnabled);
  if (wasCameraEnabled !== cameraEnabled) {
    setWasCameraEnabled(cameraEnabled);
    if (!cameraEnabled) {
      setVideo(null);
      setCharacterStream(undefined);
    }
  }

  return { video, setVideo, characterStream, setCharacterStream };
}

/** Props for the scene wrapper and the layers it fades together. */
interface SceneProps {
  /** The scene layers to show, and whether they are mid-change. */
  scene: SceneTransition<GameLayers>;
  /** The camera whose video must be mounted, including one waiting to become visible. */
  cameraToMount: ResolvedCameraMode | undefined;
  /** Whether the camera preview should be visible. */
  showPreview: boolean;
  /** Whether the layers can line up with a camera that has reported its shape. */
  show: boolean;
  /** Whether the camera's picture is flipped like a mirror. */
  mirror: boolean;
  /** Shows the debug overlay and the camera's colour key. */
  debug?: boolean;
  /** The webcam's video and stream, and what to do when the camera can't start. */
  media: ReturnType<typeof useCameraMedia> & { onCameraError: () => void };
  /** The video's shape, once the camera reports it. */
  aspectRatio: number | undefined;
  /** The people the camera last found, for the debug overlay. */
  debugPlayers: PlayerFrame[];
  /** The character canvas's element, for camera interactions. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Handles camera frames and turns body parts into interactions. */
  handlePlayers: (players: PlayerFrame[], timestamp: number) => void;
  /** Receives the video's shape from the camera. */
  setAspectRatio: Dispatch<SetStateAction<number | undefined>>;
  /** The floor a 2.5D scene is fitted to; undefined in a 2D scene. */
  floor: FloorView | undefined;
}

/** The shown scene's floor: the calibrated one with a camera, else the default one; none in a 2D scene. */
const useShownFloor = (scene: SceneTransition<GameLayers>, calibrated: Corners, mirror: boolean) => {
  const is25D = scene.sceneMode === "2.5D";
  const corners = scene.camera.enabled ? calibrated : DEFAULT_CORNERS;
  return useMemo(
    (): FloorView | undefined =>
      is25D ? { corners, crop: cropPlacement(floorCrop(corners), mirror), mirrored: mirror } : undefined,
    [is25D, corners, mirror],
  );
};

/** The players and the challenge foreground, in one stacking context so they can be sorted among each other by depth. */
function DepthStack({
  scene,
  media,
  aspectRatio,
  canvasRef,
  handlePlayers,
  mirror,
  debug,
  floor,
}: Pick<SceneProps, "scene" | "media" | "aspectRatio" | "canvasRef" | "handlePlayers" | "mirror" | "debug" | "floor">) {
  return (
    <div className={DEPTH_STACK_CLASS}>
      {scene.camera.enabled && (
        <CharacterCanvasLayerWrapper
          zIndex={UNSORTED_PLAYER_Z_INDEX}
          video={media.video}
          characterStream={media.characterStream}
          aspectRatio={aspectRatio}
          canvasRef={canvasRef}
          onPlayersChange={handlePlayers}
          mirror={mirror}
          debug={debug}
          corners={floor?.corners}
          crop={floor?.crop}
        />
      )}
      <GameLayerWrapper
        nodes={scene.layers.challenges?.foregroundLayerNodes}
        layer="challenges"
        layerHint="foreground"
      />
    </div>
  );
}

/** The scene and camera layers, grouped so a scene change can fade them together. */
function Scene({ scene, cameraToMount, showPreview, show, media, debugPlayers, setAspectRatio, ...depth }: SceneProps) {
  const { mirror, debug } = depth;
  const aids = { mirror, debug };
  return (
    <div
      className="gameScene"
      style={{ opacity: scene.opacity, pointerEvents: scene.transitioning ? "none" : undefined }}
      inert={scene.transitioning}
      aria-busy={scene.transitioning}
    >
      {show && <LowerSceneLayers layers={scene.layers} />}
      {show && <DepthStack scene={scene} media={media} {...depth} />}
      {cameraToMount && (
        <CharacterCameraLayerWrapper
          zIndex={7}
          video={media.video}
          setVideo={media.setVideo}
          characterStream={media.characterStream}
          setCharacterStream={media.setCharacterStream}
          setAspectRatio={setAspectRatio}
          onCameraError={media.onCameraError}
          showPreview={showPreview}
          {...aids}
        />
      )}
      {show && debug && (
        <DebugLayerWrapper
          zIndex={9}
          players={scene.camera.enabled ? debugPlayers : undefined}
          corners={depth.floor?.corners}
          crop={depth.floor?.crop}
          mirror={mirror}
        />
      )}
    </div>
  );
}

/**
 * Hands each camera frame's people to the interactions, and to the debug overlay while it shows. Reporting them
 * otherwise would re-render the game every frame.
 */
function useDebugPlayers(handlePlayers: SceneProps["handlePlayers"], debug: boolean | undefined) {
  const [debugPlayers, setDebugPlayers] = useState<PlayerFrame[]>([]);
  const onPlayers = useCallback(
    (players: PlayerFrame[], timestamp: number) => {
      handlePlayers(players, timestamp);
      if (debug === true) setDebugPlayers(players);
    },
    [handlePlayers, debug],
  );
  return { debugPlayers, onPlayers };
}

/** The game viewport's ref, and ways to measure it and its container. */
function useViewportMeasurements() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureViewport = useCallback(() => aspectRatioOf(viewportRef.current), []);
  const measureContainer = useCallback(() => aspectRatioOf(viewportRef.current?.parentElement), []);
  return { viewportRef, measureViewport, measureContainer };
}

/**
 * The avatar mode to use: as requested, until the camera fails to start. A camera that can't start
 * would hold the scene waiting for its shape, so the game plays on without it, in the fallback mode (or by mouse).
 */
function useCameraFallback(requested: ResolvedAvatarMode) {
  const [failed, setFailed] = useState(false);
  const onCameraError = useCallback(() => setFailed(true), []);
  const mode = failed && requested.mode === "camera" ? (requested.fallback ?? "mouse") : requested.mode;
  const camera = useMemo(() => cameraModeOf({ mode, preview: requested.preview }), [mode, requested.preview]);
  return { mouseFeet: mode === "mouse-feet", camera, onCameraError };
}

/**
 * Which camera layers to draw: the camera to mount (the latest one mounts early when it turns on, so it can report
 * the shape the viewport will take), whether its preview shows, and whether the scene layers can show (with a camera,
 * only once it reports its shape, so they line up with the video).
 */
const cameraLayersOf = (
  camera: ResolvedCameraMode,
  scene: SceneTransition<GameLayers>,
  cameraAspectRatio: number | undefined,
): Pick<SceneProps, "cameraToMount" | "showPreview" | "show"> => ({
  cameraToMount: camera.enabled ? camera : scene.camera.enabled ? scene.camera : undefined,
  showPreview: scene.camera.enabled && scene.camera.preview,
  show: !scene.camera.enabled || isDefined(cameraAspectRatio),
});

/** The viewport's target shape, and the shape a reshape starts from while one is running. */
const viewportStyle = (scene: SceneTransition<GameLayers>): CSSProperties => {
  const style: CSSProperties & { "--reshape-from"?: string; "--reshape-to"?: string } = {
    aspectRatio: scene.viewport.ratio,
  };
  if (scene.reshaping && isDefined(scene.viewport.from) && isDefined(scene.viewport.ratio)) {
    style["--reshape-from"] = `${scene.viewport.from} / 1`;
    style["--reshape-to"] = `${scene.viewport.ratio} / 1`;
  }
  return style;
};

/** The chosen camera's mirror setting and floor, as the landing page left them. */
const loadCameraSetup = () => {
  const choice = loadCameraChoice();
  return { mirror: choice.mirror, corners: calibrationOrDefault(cameraKeyOf(choice)) };
};

/** Stacks the game's scene layers, the optional camera character, debug overlay, and HUD, and runs mouse-feet input. */
export default function GameLayersLayout({
  gameLayers = {},
  sceneKey = "default",
  avatar: requestedAvatar,
  sceneMode = "2D",
  cameraRules,
  onPlayerInteraction,
  ...aids
}: GameLayersLayoutProps) {
  const [cameraAspectRatio, setCameraAspectRatio] = useState<number>();
  // Read once: changing them means going back to the landing page
  const [{ mirror, corners }] = useState(loadCameraSetup);
  const { viewportRef, measureViewport, measureContainer } = useViewportMeasurements();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { mouseFeet, camera, onCameraError } = useCameraFallback(requestedAvatar);
  const scene = useSceneTransition({
    layers: gameLayers,
    sceneKey,
    camera,
    sceneMode,
    shape: viewportShapeOf(sceneMode, camera, cameraAspectRatio, corners),
    reducedMotion,
    measureViewport,
    measureContainer,
  });
  // Keep the media until the shown camera goes too, so a camera-off reshape keeps its preview alive
  const media = useCameraMedia(camera.enabled || scene.camera.enabled);

  const { canvasRef, handlePlayers } = usePlayerInteractions(
    cameraRules,
    onPlayerInteraction,
    scene.camera.enabled && !scene.transitioning,
    { mirrored: mirror, onFloor: scene.sceneMode === "2.5D" },
  );
  const { debugPlayers, onPlayers } = useDebugPlayers(handlePlayers, aids.debug);
  useMouseFeet(viewportRef, cameraRules, onPlayerInteraction, { enabled: mouseFeet, paused: scene.transitioning });
  const floor = useShownFloor(scene, corners, mirror);
  useFloorPlacement(viewportRef, floor);

  return (
    <div
      ref={viewportRef}
      id="game-viewport"
      className={`gameViewport${scene.reshaping ? " gameViewportReshaping" : ""}`}
      style={viewportStyle(scene)}
    >
      <Scene
        scene={scene}
        {...cameraLayersOf(camera, scene, cameraAspectRatio)}
        mirror={mirror}
        debug={aids.debug}
        media={{ ...media, onCameraError }}
        aspectRatio={cameraAspectRatio}
        debugPlayers={debugPlayers}
        canvasRef={canvasRef}
        handlePlayers={onPlayers}
        setAspectRatio={setCameraAspectRatio}
        floor={floor}
      />
      <HudLayerWrapper zIndex={10} {...aids} />
    </div>
  );
}
