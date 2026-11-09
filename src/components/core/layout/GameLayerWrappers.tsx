import { Fragment, type CSSProperties, type ReactNode } from "react";
import useAppConfig from "../../../providers/AppConfigHook";
import { isDefined } from "../../../util/ObjectUtils";
import CharacterCamera from "../../camera/CharacterCamera";
import CharacterCanvas from "../../camera/CharacterCanvas";
import type { Corners, CropPlacement } from "../../camera/FloorGeometry";
import FloorOverlay from "../../camera/FloorOverlay";
import type { PlayerFrame } from "../../camera/PlayerMonitor";
import HeadsUpDisplay from "../HeadsUpDisplay";
import type { LayerHint } from "../scene/GameSceneComponent";
import GameChallengeGrid from "./GameChallengeGrid";

/**
 * Props shared by the layer wrappers. Each wrapper uses only the subset it needs, and
 * assumes the ones it requires are provided.
 */
export interface LayerNodeProps {
  /** Stacking order of the layer; see `GameLayersLayout`. */
  zIndex?: number;
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
  /** The people the camera last found, for the debug overlay; none without a camera. */
  players?: PlayerFrame[];
  /** The floor a 2.5D scene shows, for the debug overlay; none in a 2D scene. */
  corners?: Corners;
  /** The character canvas's element, for converting element positions into mask positions. */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Called every frame with the people the camera found, and when the frame was taken. */
  onPlayersChange?: (players: PlayerFrame[], timestamp: number) => void;
  /** Whether the camera's picture is flipped like a mirror. */
  mirror?: boolean;
  /** Where the camera image sits so a 2.5D scene's crop of it fills the viewport; the whole image fits it if not given. */
  crop?: CropPlacement;
  /** Whether debug aids (people tinted apart, body-part markers, the floor) are shown. */
  debug?: boolean;
  /** Switches the debug aids on or off, from the HUD. */
  onToggleDebug?: () => void;
  /** The scene components to render in the layer, one per grid column. */
  nodes?: ReactNode[];
  /** Name of the layer (overview, stage or challenges). */
  layer?: string;
  /** Whether this is the layer's background or foreground. */
  layerHint?: LayerHint;
}

/**
 * A background or foreground layer of the overview, stage or challenges: its scene components in a
 * {@link GameChallengeGrid}. The layer lets pointer events through; each scene handles its own.
 */
export const GameLayerWrapper = ({ nodes, style, zIndex, layer, layerHint }: LayerNodeProps) => (
  <div
    id={`${layer!}-${layerHint!}-container`}
    className={`outerStyle noClicks scene-${layerHint!}`}
    style={{ ...style, zIndex: zIndex }}
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
  mirror,
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
      onError={onCameraError!}
      mirror={mirror!}
    />
  </div>
);

/** The box the whole camera image fills: the viewport, or a larger box when a 2.5D scene crops the image to its floor. */
const imageBoxStyle = (crop: CropPlacement | undefined): CSSProperties | undefined =>
  isDefined(crop)
    ? { width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, left: `${crop.left * 100}%`, top: 0 }
    : undefined;

/**
 * Layer holding the debug overlay, over the camera image's box: the floor in a 2.5D scene, and each player's head,
 * hands and feet with the camera on. It takes no pointer events, so it never covers what the player touches.
 */
export const DebugLayerWrapper = ({ style, zIndex, players, corners, crop, mirror }: LayerNodeProps) => (
  <div
    id="debug-overlay-container"
    className="outerStyle noClicks"
    style={{ ...style, ...imageBoxStyle(crop), zIndex: zIndex, transform: mirror ? "scaleX(-1)" : undefined }}
  >
    <FloorOverlay className="innerStyle" corners={corners} players={players} />
  </div>
);

/** Layer holding the players' silhouettes ({@link CharacterCanvas}), which also reports the people it finds. */
export const CharacterCanvasLayerWrapper = ({
  style,
  zIndex,
  video,
  characterStream,
  aspectRatio,
  canvasRef,
  onPlayersChange,
  mirror,
  debug,
  corners,
  crop,
}: LayerNodeProps) => {
  const { showFps } = useAppConfig();
  return (
    // Clicks pass through to the game layers beneath; the silhouette is decoration
    <div
      id="character-canvas-container"
      className="outerStyle noClicks characterCanvasStack"
      style={imageBoxStyle(crop)}
    >
      <CharacterCanvas
        video={video ?? null}
        mediaStream={characterStream}
        className="innerStyle"
        style={{ ...style, transform: mirror ? "scaleX(-1)" : undefined, aspectRatio: aspectRatio, zIndex }}
        onPlayersChange={onPlayersChange}
        canvasRef={canvasRef}
        maskType={debug ? "colored" : "binary"}
        showStats={debug || showFps}
        floor={corners}
        mirrored={mirror}
      />
    </div>
  );
};

/** Top layer, holding the {@link HeadsUpDisplay}. */
export const HudLayerWrapper = ({ style, zIndex, debug, onToggleDebug }: LayerNodeProps) => (
  <div id="hud-layer-container" className="hudStyle childClicksOnly" style={{ ...style, zIndex: zIndex }}>
    <HeadsUpDisplay debug={debug === true} onToggleDebug={onToggleDebug} />
  </div>
);
