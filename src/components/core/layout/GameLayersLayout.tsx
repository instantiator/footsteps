import { useCallback, useState, type ReactNode } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import type { FeetPositions } from "../../camera/CameraSupport";
import type { ResolvedCameraMode } from "../logic/CameraModeUtils";
import "./GameLayersLayout.css";
import {
  CharacterCameraLayerWrapper,
  CharacterCanvasLayerWrapper,
  DebugLayerWrapper,
  GameLayerWrapper,
  HudLayerWrapper,
} from "./GameLayerWrappers";

/** Props for {@link GameLayersLayout}. */
interface GameLayersLayoutProps {
  /** The nodes to show in each display layer. */
  gameLayers?: GameLayers;
  /** The game's camera settings, already resolved for the displays currently shown. */
  camera: ResolvedCameraMode;
  /** Shows the debug overlay and the camera's colour key. */
  debug?: boolean;
  /** Called when an element in a layer is clicked; returns whether the click was handled. */
  onElementClick?: (layerId: string, targetId: string) => boolean;
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

/** Stacks the game's display layers, the optional camera character, debug overlay, and HUD. */
export default function GameLayersLayout({ gameLayers = {}, camera, debug, onElementClick }: GameLayersLayoutProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [characterStream, setCharacterStream] = useState<MediaStream | undefined>(undefined);
  const [feetPositions, setFeetPositions] = useState<FeetPositions>({});
  const [aspectRatio, setAspectRatio] = useState<number>();

  const cameraEnabled = camera.enabled;
  // With a camera, wait for its aspect ratio so the layers line up with the video
  const show = !cameraEnabled || isDefined(aspectRatio);

  // Forget a disabled camera's video and stream, so re-enabling asks for a fresh stream instead of
  // reusing one whose tracks the camera stopped when it unmounted (see the React note on adjusting
  // state when a prop changes)
  const [wasCameraEnabled, setWasCameraEnabled] = useState(cameraEnabled);
  if (wasCameraEnabled !== cameraEnabled) {
    setWasCameraEnabled(cameraEnabled);
    if (!cameraEnabled) {
      setVideo(null);
      setCharacterStream(undefined);
    }
  }

  const clickHandler: LayerClickHandler = useCallback(
    (event, layerIdOverride) => {
      const targetId = (event.target as HTMLElement)?.id;
      if (targetId) onElementClick?.(layerIdOverride ?? event.currentTarget.id, targetId);
    },
    [onElementClick],
  );

  return (
    <>
      {show && <LowerDisplayLayers layers={gameLayers} clickHandler={clickHandler} />}
      {show && cameraEnabled && (
        <CharacterCanvasLayerWrapper
          zIndex={6}
          video={video}
          characterStream={characterStream}
          aspectRatio={aspectRatio}
          setFeetPositions={setFeetPositions}
          debug={debug}
        />
      )}
      {cameraEnabled && (
        <CharacterCameraLayerWrapper
          zIndex={7}
          video={video}
          setVideo={setVideo}
          characterStream={characterStream}
          setCharacterStream={setCharacterStream}
          setAspectRatio={setAspectRatio}
          showPreview={camera.preview}
          debug={debug}
        />
      )}
      {show && (
        <UpperDisplayLayers
          layers={gameLayers}
          clickHandler={clickHandler}
          debug={debug}
          feetPositions={feetPositions}
          cameraEnabled={cameraEnabled}
        />
      )}
      <HudLayerWrapper zIndex={10} />
    </>
  );
}
