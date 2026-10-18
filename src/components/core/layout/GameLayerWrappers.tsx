import { Fragment, type CSSProperties, type ReactNode } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import CameraDebugOverlay from "../../camera/CameraDebugOverlay";
import type { FeetPositions } from "../../camera/CameraSupport";
import CharacterCamera from "../../camera/CharacterCamera";
import CharacterCanvas from "../../camera/CharacterCanvas";
import HeadsUpDisplay from "../HeadsUpDisplay";
import type { LayerHint } from "../display/GameDisplayComponent";
import GameChallengeGrid from "./GameChallengeGrid";

export interface LayerNodeProps {
  zIndex: number;
  style?: CSSProperties;
  aspectRatio?: number;
  setAspectRatio?: React.Dispatch<React.SetStateAction<number | undefined>>;
  video?: HTMLVideoElement | null;
  setVideo?: React.Dispatch<React.SetStateAction<HTMLVideoElement | null>>;
  characterStream?: MediaStream | undefined;
  setCharacterStream?: React.Dispatch<React.SetStateAction<MediaStream | undefined>>;
  feetPositions?: FeetPositions;
  setFeetPositions?: React.Dispatch<React.SetStateAction<FeetPositions>>;
  debug?: boolean;
  clickHandler?: (event: React.MouseEvent<HTMLElement, MouseEvent>, layerIdOverride?: string) => void;
  nodes?: ReactNode[];
  cameraEnabled?: boolean;
  layer?: string;
  layerHint?: LayerHint;
}

export const GameLayerWrapper = ({ nodes, style, zIndex, clickHandler, layer, layerHint }: LayerNodeProps) => (
  <div
    id={`${layer!}-${layerHint!}-container`}
    className="outerStyle noClicks"
    style={{ ...style, zIndex: zIndex }}
    onClick={(event) => clickHandler?.(event, layer!)}
  >
    {isDefined(nodes) && (
      <GameChallengeGrid layer={layer!} layerHint={layerHint!} className="innerStyle noClicks">
        {nodes.map((node, index) => (
          <Fragment key={`${layer!}-${layerHint!}-grid-content-${index}`}>{node}</Fragment>
        ))}
      </GameChallengeGrid>
    )}
  </div>
);

export const CharacterCameraLayerWrapper = ({
  style,
  zIndex,
  video,
  setVideo,
  characterStream,
  setCharacterStream,
  setAspectRatio: onAspectChange,
  debug,
}: LayerNodeProps) => (
  <div id="character-camera-layer" className="characterCamera" style={{ ...style, zIndex: zIndex }}>
    <CharacterCamera
      video={video ?? null}
      setVideo={setVideo!}
      stream={characterStream}
      setStream={setCharacterStream!}
      onAspectChange={onAspectChange!}
      colorKey={debug!}
    />
  </div>
);

export const DebugLayerWrapper = ({ style, zIndex, clickHandler, feetPositions, cameraEnabled }: LayerNodeProps) => (
  <div
    id="debug-overlay-container"
    className="outerStyle noClicks"
    onClick={(event) => clickHandler?.(event, undefined)}
    style={{ ...style, zIndex: zIndex }}
  >
    {cameraEnabled && <CameraDebugOverlay className="innerStyle childClicksOnly" feetPositions={feetPositions} />}
  </div>
);

export const CharacterCanvasLayerWrapper = ({
  style,
  zIndex,
  video,
  characterStream,
  aspectRatio,
  setFeetPositions,
  debug,
}: LayerNodeProps) => (
  <div id="character-canvas-container" className="outerStyle">
    <CharacterCanvas
      video={video ?? null}
      mediaStream={characterStream}
      className="innerStyle"
      style={{ ...style, transform: "scaleX(-1)", aspectRatio: aspectRatio, zIndex }}
      onFeetPositionsChange={setFeetPositions}
      maskType={debug ? "colored" : "binary"}
    />
  </div>
);

export const HudLayerWrapper = ({ style, zIndex }: LayerNodeProps) => (
  <div id="hud-layer-container" className="hudStyle childClicksOnly" style={{ ...style, zIndex: zIndex }}>
    <HeadsUpDisplay />
  </div>
);
