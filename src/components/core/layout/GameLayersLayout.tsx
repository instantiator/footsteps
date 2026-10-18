import { useCallback, useState, type ReactNode } from "react";
import type { CameraModuleData } from "../../../entities/data/GameModuleData";
import { isDefined } from "../../../util/ObjectUtils";
import type { FeetPositions } from "../../camera/CameraSupport";
import "./GameLayersLayout.css";
import {
  CharacterCameraLayerWrapper,
  CharacterCanvasLayerWrapper,
  DebugLayerWrapper,
  GameLayerWrapper,
  HudLayerWrapper,
} from "./GameLayerWrappers";

interface GameLayersLayoutProps {
  gameLayers?: GameLayers;
  cameraLayer: CameraModuleData | undefined;
  debug?: boolean;
  onElementClick?: (layerId: string, targetId: string) => boolean;
}

export interface GameLayers {
  overview?: { backgroundLayerNodes: ReactNode[] | undefined; foregroundLayerNodes: ReactNode[] | undefined };
  stage?: { backgroundLayerNodes: ReactNode[] | undefined; foregroundLayerNodes: ReactNode[] | undefined };
  challenges?: { backgroundLayerNodes: ReactNode[] | undefined; foregroundLayerNodes: ReactNode[] | undefined };
}

type LayerClickHandler = (event: React.SyntheticEvent<HTMLElement>, layerIdOverride?: string) => void;

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
export default function GameLayersLayout({
  gameLayers = {},
  cameraLayer,
  debug,
  onElementClick,
}: GameLayersLayoutProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [characterStream, setCharacterStream] = useState<MediaStream | undefined>(undefined);
  const [feetPositions, setFeetPositions] = useState<FeetPositions>({});
  const [aspectRatio, setAspectRatio] = useState<number>();

  const cameraEnabled = cameraLayer?.enabled === true;
  // With a camera, wait for its aspect ratio so the layers line up with the video
  const show = !cameraEnabled || isDefined(aspectRatio);

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
