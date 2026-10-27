import { Fragment, type CSSProperties, type ReactNode } from "react";
import useAppConfig from "../../../providers/AppConfigHook";
import { isDefined } from "../../../util/ObjectUtils";
import CameraDebugOverlay from "../../camera/CameraDebugOverlay";
import type { FeetPositions } from "../../camera/CameraSupport";
import CharacterCamera from "../../camera/CharacterCamera";
import CharacterCanvas from "../../camera/CharacterCanvas";
import type { PlayerFrame } from "../../camera/PlayerMonitor";
import HeadsUpDisplay from "../HeadsUpDisplay";
import type { LayerHint } from "../display/GameDisplayComponent";
import GameChallengeGrid from "./GameChallengeGrid";

/**
 * Props shared by the layer wrappers. Each wrapper uses only the subset it needs, and
 * assumes the ones it requires are provided.
 */
export interface LayerNodeProps {
  /** Stacking order of the layer; see `GameLayersLayout`. */
  zIndex: number;
  /** Extra style for the layer's container. */
  style?: CSSProperties;
  /** The webcam video's aspect ratio, used to size the character canvas to match. */
  aspectRatio?: number;
  /** Lets the camera report the video's aspect ratio. */
  setAspectRatio?: React.Dispatch<React.SetStateAction<number | undefined>>;
  /** The webcam's video element, shared between the camera and the character canvas. */
  video?: HTMLVideoElement | null;
  /** Lets the camera share its video element. */
  setVideo?: React.Dispatch<React.SetStateAction<HTMLVideoElement | null>>;
  /** The webcam stream, shared between the camera and the character canvas. */
  characterStream?: MediaStream | undefined;
  /** Called when the camera can't start. */
  onCameraError?: () => void;
  /** Lets the camera share its stream once the player allows it. */
  setCharacterStream?: React.Dispatch<React.SetStateAction<MediaStream | undefined>>;
  /** Whether the camera preview shows; defaults to true. */
  showPreview?: boolean;
  /** Where the player's feet were last seen, for the debug overlay. */
  feetPositions?: FeetPositions;
  /** Lets the character canvas report the feet positions. */
  setFeetPositions?: React.Dispatch<React.SetStateAction<FeetPositions>>;
  /** The character canvas's element, for converting element positions into mask positions. */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Called every frame with the people the camera found, and when the frame was taken. */
  onPlayersChange?: (players: PlayerFrame[], timestamp: number) => void;
  /** Whether debug aids (colour key, coloured mask) are shown. */
  debug?: boolean;
  /** The display components to render in the layer, one per grid column. */
  nodes?: ReactNode[];
  /** Whether the game uses the camera. */
  cameraEnabled?: boolean;
  /** Name of the layer (overview, stage or challenges). */
  layer?: string;
  /** Whether this is the layer's background or foreground. */
  layerHint?: LayerHint;
}

/**
 * A background or foreground layer of the overview, stage or challenges: its display components in a
 * {@link GameChallengeGrid}. The layer lets pointer events through; each display handles its own.
 */
export const GameLayerWrapper = ({ nodes, style, zIndex, layer, layerHint }: LayerNodeProps) => (
  <div id={`${layer!}-${layerHint!}-container`} className="outerStyle noClicks" style={{ ...style, zIndex: zIndex }}>
    {isDefined(nodes) && (
      <GameChallengeGrid layer={layer!} layerHint={layerHint!} className="innerStyle noClicks">
        {nodes.map((node, index) => (
          <Fragment key={`${layer!}-${layerHint!}-grid-content-${index}`}>{node}</Fragment>
        ))}
      </GameChallengeGrid>
    )}
  </div>
);

/** Layer holding the webcam preview ({@link CharacterCamera}). */
export const CharacterCameraLayerWrapper = ({
  style,
  zIndex,
  video,
  setVideo,
  characterStream,
  setCharacterStream,
  setAspectRatio: onAspectChange,
  onCameraError,
  showPreview = true,
  debug,
}: LayerNodeProps) => (
  <div
    id="character-camera-layer"
    className="characterCamera"
    style={{ ...style, zIndex: zIndex, visibility: showPreview ? "visible" : "hidden" }}
  >
    <CharacterCamera
      video={video ?? null}
      setVideo={setVideo!}
      stream={characterStream}
      setStream={setCharacterStream!}
      onAspectChange={onAspectChange!}
      colorKey={debug!}
      onError={onCameraError!}
    />
  </div>
);

/** Layer holding the debug overlay: feet markers when the camera is enabled. They take no pointer events, so they never cover what the player touches. */
export const DebugLayerWrapper = ({ style, zIndex, feetPositions, cameraEnabled }: LayerNodeProps) => (
  <div id="debug-overlay-container" className="outerStyle noClicks" style={{ ...style, zIndex: zIndex }}>
    {cameraEnabled && <CameraDebugOverlay className="innerStyle noClicks" feetPositions={feetPositions} />}
  </div>
);

/** Layer holding the player's mirrored silhouette ({@link CharacterCanvas}), which also reports their feet positions. */
export const CharacterCanvasLayerWrapper = ({
  style,
  zIndex,
  video,
  characterStream,
  aspectRatio,
  setFeetPositions,
  canvasRef,
  onPlayersChange,
  debug,
}: LayerNodeProps) => {
  const { showFps } = useAppConfig();
  return (
    // Clicks pass through to the game layers beneath; the silhouette is decoration
    <div id="character-canvas-container" className="outerStyle noClicks">
      <CharacterCanvas
        video={video ?? null}
        mediaStream={characterStream}
        className="innerStyle"
        style={{ ...style, transform: "scaleX(-1)", aspectRatio: aspectRatio, zIndex }}
        onFeetPositionsChange={setFeetPositions}
        onPlayersChange={onPlayersChange}
        canvasRef={canvasRef}
        maskType={debug ? "colored" : "binary"}
        showStats={debug || showFps}
      />
    </div>
  );
};

/** Top layer, holding the {@link HeadsUpDisplay}. */
export const HudLayerWrapper = ({ style, zIndex }: LayerNodeProps) => (
  <div id="hud-layer-container" className="hudStyle childClicksOnly" style={{ ...style, zIndex: zIndex }}>
    <HeadsUpDisplay />
  </div>
);
