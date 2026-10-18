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

export default function GameLayersLayout({
  gameLayers: displayLayers,
  cameraLayer,
  debug,
  onElementClick,
}: GameLayersLayoutProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [characterStream, setCharacterStream] = useState<MediaStream | undefined>(undefined);
  const [feetPositions, setFeetPositions] = useState<FeetPositions>({});
  const [aspectRatio, setAspectRatio] = useState<number>();

  const cameraEnabled = cameraLayer?.enabled === true;
  const show = !cameraEnabled || isDefined(aspectRatio);

  const clickHandler = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>, layerIdOverride?: string) => {
      const targetId = (event.target as HTMLElement)?.id;
      const layerId = isDefined(layerIdOverride) ? layerIdOverride : event.currentTarget.id;
      if (isDefined(onElementClick) && targetId) {
        const handled = onElementClick(layerId, targetId);
        if (handled) {
          // event.stopPropagation();
        }
      }
    },
    [onElementClick],
  );

  return (
    <>
      {show && (
        <>
          <GameLayerWrapper
            zIndex={1}
            nodes={[displayLayers?.overview?.backgroundLayerNodes]}
            layer="overview"
            layerHint="background"
          />

          <GameLayerWrapper
            zIndex={2}
            nodes={[displayLayers?.overview?.foregroundLayerNodes]}
            clickHandler={clickHandler}
            layer="overview"
            layerHint="foreground"
          />

          <GameLayerWrapper
            zIndex={3}
            nodes={[displayLayers?.stage?.backgroundLayerNodes]}
            layer="stage"
            layerHint="background"
          />

          <GameLayerWrapper
            zIndex={4}
            nodes={[displayLayers?.stage?.foregroundLayerNodes]}
            clickHandler={clickHandler}
            layer="stage"
            layerHint="foreground"
          />

          <GameLayerWrapper
            zIndex={5}
            nodes={displayLayers?.challenges?.backgroundLayerNodes}
            layer="challenges"
            layerHint="background"
          />

          {cameraEnabled && (
            <CharacterCanvasLayerWrapper
              zIndex={6}
              video={video}
              characterStream={characterStream}
              aspectRatio={aspectRatio}
              setFeetPositions={setFeetPositions}
            />
          )}
        </>
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
        <>
          <GameLayerWrapper
            zIndex={8}
            nodes={displayLayers?.challenges?.foregroundLayerNodes}
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
      )}

      <HudLayerWrapper zIndex={10} />
    </>
  );
}
