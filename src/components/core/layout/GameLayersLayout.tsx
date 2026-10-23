import { useMediaQuery } from "@uidotdev/usehooks";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import type { GameInteractionTarget } from "../../../entities/data/displays/GameDisplayData";
import { isDefined } from "../../../util/ObjectUtils";
import type { FeetPositions } from "../../camera/CameraSupport";
import type { PlayerFrame, PlayerMonitorEvent } from "../../camera/PlayerMonitor";
import type { ResolvedCameraMode } from "../logic/CameraModeUtils";
import "./GameLayersLayout.css";
import {
  CharacterCameraLayerWrapper,
  CharacterCanvasLayerWrapper,
  DebugLayerWrapper,
  GameLayerWrapper,
  HudLayerWrapper,
} from "./GameLayerWrappers";
import { usePlayerInteractions } from "./PlayerInteractionHook";
import useSceneTransition, { type SceneTransition } from "./useSceneTransition";

/** Props for {@link GameLayersLayout}. */
interface GameLayersLayoutProps {
  /** The nodes to show in each display layer. */
  gameLayers?: GameLayers;
  /** Identifies the display these layers belong to, so a cut to another display can fade. */
  displayKey?: string;
  /** The game's camera settings, already resolved for the displays currently shown. */
  camera: ResolvedCameraMode;
  /** Shows the debug overlay and the camera's colour key. */
  debug?: boolean;
  /** Called when an element in a layer is clicked; returns whether the click was handled. */
  onElementClick?: (layerId: string, targetId: string) => boolean;
  /** The elements the camera can interact with, by element id. */
  interactionTargets?: Record<string, GameInteractionTarget>;
  /** Called when a player interacts with an element through the camera. */
  onPlayerInteraction?: (event: PlayerMonitorEvent) => void;
}

/** The nodes for the background and foreground of the overview, the stage, and its challenges. */
export interface GameLayers {
  /** The overview display, when no stage is open. */
  overview?: {
    /** The background half of the display. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
  /** The open stage's shared display. */
  stage?: {
    /** The background half of the display. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
  /** The active challenges' displays, one node per challenge. */
  challenges?: {
    /** The background half of the display. */
    backgroundLayerNodes: ReactNode[] | undefined;
    /** The foreground half; only the challenges' foreground sits above the camera character. */
    foregroundLayerNodes: ReactNode[] | undefined;
  };
}

/** Handles a click or key activation within a layer; `layerIdOverride` replaces the layer's own id as the source. */
type LayerClickHandler = (event: React.SyntheticEvent<HTMLElement>, layerIdOverride?: string) => void;

/** The given element's width-to-height ratio, if it has a size. */
const aspectRatioOf = (element: Element | null | undefined): number | undefined => {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect.width / rect.height : undefined;
};

/** Props for the groups of display layers. */
interface DisplayLayersProps {
  layers: GameLayers;
  clickHandler: LayerClickHandler;
}

/** The overview, stage, and challenge background layers, which sit beneath the camera character. */
function LowerDisplayLayers({ layers: { overview, stage, challenges }, clickHandler }: DisplayLayersProps) {
  return (
    <>
      <GameLayerWrapper zIndex={1} nodes={[overview?.backgroundLayerNodes]} layer="overview" layerHint="background" />
      <GameLayerWrapper
        zIndex={2}
        nodes={[overview?.foregroundLayerNodes]}
        clickHandler={clickHandler}
        layer="overview"
        layerHint="foreground"
      />
      <GameLayerWrapper zIndex={3} nodes={[stage?.backgroundLayerNodes]} layer="stage" layerHint="background" />
      <GameLayerWrapper
        zIndex={4}
        nodes={[stage?.foregroundLayerNodes]}
        clickHandler={clickHandler}
        layer="stage"
        layerHint="foreground"
      />
      <GameLayerWrapper zIndex={5} nodes={challenges?.backgroundLayerNodes} layer="challenges" layerHint="background" />
    </>
  );
}

/** The challenge foreground layer, and the debug overlay when debugging; both sit above the camera. */
function UpperDisplayLayers({
  layers,
  clickHandler,
  debug,
  feetPositions,
  cameraEnabled,
}: DisplayLayersProps & { debug?: boolean; feetPositions: FeetPositions; cameraEnabled: boolean }) {
  return (
    <>
      <GameLayerWrapper
        zIndex={8}
        nodes={layers.challenges?.foregroundLayerNodes}
        clickHandler={clickHandler}
        layer="challenges"
        layerHint="foreground"
      />
      {debug && (
        <DebugLayerWrapper
          zIndex={9}
          clickHandler={clickHandler}
          feetPositions={feetPositions}
          cameraEnabled={cameraEnabled}
        />
      )}
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
  /** The display layers to show, and whether they are mid-change. */
  scene: SceneTransition<GameLayers>;
  /** The camera whose video must be mounted, including one waiting to become visible. */
  cameraToMount: ResolvedCameraMode | undefined;
  /** Whether the camera preview should be visible. */
  showPreview: boolean;
  /** Whether the layers can line up with a camera that has reported its shape. */
  show: boolean;
  /** Shows the debug overlay and the camera's colour key. */
  debug?: boolean;
  /** Handles clicks and key activations within a layer. */
  clickHandler: LayerClickHandler;
  /** The webcam's video and stream. */
  media: ReturnType<typeof useCameraMedia>;
  /** The video's shape, once the camera reports it. */
  aspectRatio: number | undefined;
  /** Receives the players' feet positions for the debug overlay. */
  setFeetPositions: Dispatch<SetStateAction<FeetPositions>>;
  /** The players' feet positions, for the debug overlay. */
  feetPositions: FeetPositions;
  /** The character canvas's element, for camera interactions. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Handles camera frames and turns body parts into interactions. */
  handlePlayers: (players: PlayerFrame[], timestamp: number) => void;
  /** Receives the video's shape from the camera. */
  setAspectRatio: Dispatch<SetStateAction<number | undefined>>;
}

/** The display and camera layers, grouped so a display change can fade them together. */
function Scene({
  scene,
  cameraToMount,
  showPreview,
  show,
  debug,
  clickHandler,
  media,
  aspectRatio,
  setFeetPositions,
  feetPositions,
  canvasRef,
  handlePlayers,
  setAspectRatio,
}: SceneProps) {
  return (
    <div
      className="gameScene"
      style={{ opacity: scene.opacity, pointerEvents: scene.transitioning ? "none" : undefined }}
      inert={scene.transitioning}
      aria-busy={scene.transitioning}
    >
      {show && <LowerDisplayLayers layers={scene.layers} clickHandler={clickHandler} />}
      {show && scene.camera.enabled && (
        <CharacterCanvasLayerWrapper
          zIndex={6}
          video={media.video}
          characterStream={media.characterStream}
          aspectRatio={aspectRatio}
          setFeetPositions={setFeetPositions}
          canvasRef={canvasRef}
          onPlayersChange={handlePlayers}
          debug={debug}
        />
      )}
      {cameraToMount && (
        <CharacterCameraLayerWrapper
          zIndex={7}
          video={media.video}
          setVideo={media.setVideo}
          characterStream={media.characterStream}
          setCharacterStream={media.setCharacterStream}
          setAspectRatio={setAspectRatio}
          showPreview={showPreview}
          debug={debug}
        />
      )}
      {show && (
        <UpperDisplayLayers
          layers={scene.layers}
          clickHandler={clickHandler}
          debug={debug}
          feetPositions={feetPositions}
          cameraEnabled={scene.camera.enabled}
        />
      )}
    </div>
  );
}

/** The game viewport's ref, and ways to measure it and its container. */
function useViewportMeasurements() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureViewport = useCallback(() => aspectRatioOf(viewportRef.current), []);
  const measureContainer = useCallback(() => aspectRatioOf(viewportRef.current?.parentElement), []);
  return { viewportRef, measureViewport, measureContainer };
}

/** Calls the game's click handler for elements inside a layer. */
function useLayerClickHandler(onElementClick: GameLayersLayoutProps["onElementClick"]): LayerClickHandler {
  return useCallback(
    (event, layerIdOverride) => {
      const targetId = (event.target as HTMLElement)?.id;
      if (targetId) onElementClick?.(layerIdOverride ?? event.currentTarget.id, targetId);
    },
    [onElementClick],
  );
}

/** The viewport's target shape, and the shape a camera reshape starts from while one is running. */
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

/** Stacks the game's display layers, the optional camera character, debug overlay, and HUD. */
export default function GameLayersLayout({
  gameLayers = {},
  displayKey = "default",
  camera,
  debug,
  onElementClick,
  interactionTargets,
  onPlayerInteraction,
}: GameLayersLayoutProps) {
  const [feetPositions, setFeetPositions] = useState<FeetPositions>({});
  const [cameraAspectRatio, setCameraAspectRatio] = useState<number>();
  const { viewportRef, measureViewport, measureContainer } = useViewportMeasurements();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const scene = useSceneTransition({
    layers: gameLayers,
    displayKey,
    camera,
    cameraAspectRatio,
    reducedMotion,
    measureViewport,
    measureContainer,
  });
  // Keep the media until the shown camera goes too, so a camera-off reshape keeps its preview alive
  const media = useCameraMedia(camera.enabled || scene.camera.enabled);

  // The latest camera mounts early when it turns on, so it can report the shape the viewport will take
  const cameraToMount = camera.enabled ? camera : scene.camera.enabled ? scene.camera : undefined;
  const showPreview = scene.camera.enabled && scene.camera.preview;

  // With a camera, wait for its aspect ratio so the layers line up with the video
  const show = !scene.camera.enabled || isDefined(cameraAspectRatio);

  const clickHandler = useLayerClickHandler(onElementClick);

  const { canvasRef, handlePlayers } = usePlayerInteractions(
    interactionTargets,
    onPlayerInteraction,
    scene.camera.enabled && !scene.transitioning,
  );

  return (
    <div
      ref={viewportRef}
      id="game-viewport"
      className={`gameViewport${scene.reshaping ? " gameViewportReshaping" : ""}`}
      style={viewportStyle(scene)}
    >
      <Scene
        scene={scene}
        cameraToMount={cameraToMount}
        showPreview={showPreview}
        show={show}
        debug={debug}
        clickHandler={clickHandler}
        media={media}
        aspectRatio={cameraAspectRatio}
        setFeetPositions={setFeetPositions}
        feetPositions={feetPositions}
        canvasRef={canvasRef}
        handlePlayers={handlePlayers}
        setAspectRatio={setCameraAspectRatio}
      />
      <HudLayerWrapper zIndex={10} />
    </div>
  );
}
