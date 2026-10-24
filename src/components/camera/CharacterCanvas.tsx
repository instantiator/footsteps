import * as bodySeg from "@tensorflow-models/body-segmentation";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState, type RefObject } from "react";
import { drawMask } from "./BodySegSupport";
import { findFeet, type FeetPositions } from "./CameraSupport";
import type { PlayerFrame } from "./PlayerMonitor";

/** The body segmentation model. */
type BodySegNet = bodySeg.BodySegmenter;
/** The model's result for one frame: one segmentation per person. */
type Segmentation = Awaited<ReturnType<BodySegNet["segmentPeople"]>>;

/** Props for {@link CharacterCanvas}. */
interface CharacterCanvasProps {
  /** The webcam video to segment. */
  video: HTMLVideoElement | null;
  /** The webcam stream; the model is only loaded while there is one. */
  mediaStream: MediaStream | undefined;
  /** Feet lower than this (% of frame height) count as off screen and are not reported. */
  offScreenThreshold_percent?: number;
  /** Called every frame with the feet of everyone found (empty if nobody is). */
  onFeetPositionsChange?: (feetPositions: FeetPositions) => void;
  /**
   * Called every frame with the people found (empty if nobody is) and when the frame was taken, in milliseconds.
   *
   * NB. Keep this callback stable: a new one restarts the segmentation loop.
   */
  onPlayersChange?: (players: PlayerFrame[], timestamp: number) => void;
  /** The canvas element, for callers that need its position on the page; an internal ref is used when omitted. */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  className?: string;
  style?: React.CSSProperties;
  /** How to draw the silhouette; see {@link drawMask}. Defaults to "binary". */
  maskType?: "binary" | "colored" | "extremities";
}

/** BodyPix on ResNet50, for accuracy over speed. */
const MODEL_CONFIG: bodySeg.BodyPixModelConfig = {
  architecture: "ResNet50",
  outputStride: 32,
  multiplier: 1.0, // Use 1.0 for ResNet50
  quantBytes: 4,
};

/** Per-frame segmentation settings: high resolution and body parts, mirrored to match the preview. */
const SEGMENTATION_CONFIG = {
  internalResolution: "high", // Adjust resolution for performance
  flipHorizontal: true, // Often needed for webcams
  segmentationThreshold: 0.65, // Confidence threshold
  segmentBodyParts: true,
} as const;

/** Loads the segmentation model, or resolves to null if it fails to load. */
const loadBodySegNet = async (): Promise<BodySegNet | null> => {
  await tf.ready();
  try {
    const bodySegNet = await bodySeg.createSegmenter(bodySeg.SupportedModels.BodyPix, MODEL_CONFIG);
    return bodySegNet;
  } catch (error) {
    console.error("Failed to load BodySeg model:", error);
    return null;
  }
};

/** Holds the segmentation model while there is a camera stream, and releases it when there isn't. */
const useBodySegNet = (mediaStream: MediaStream | undefined): BodySegNet | null => {
  const [net, setNet] = useState<BodySegNet | null>(null);

  useEffect(() => {
    if (!mediaStream) return;
    let loaded: BodySegNet | null = null;
    let cancelled = false;
    loadBodySegNet().then((bodySegNet) => {
      if (cancelled) return bodySegNet?.dispose();
      loaded = bodySegNet;
      setNet(bodySegNet);
    });
    return () => {
      cancelled = true;
      loaded?.dispose();
      setNet(null);
    };
  }, [mediaStream]);

  return net;
};

/**
 * Reads each segmented person's mask and feet, once per frame.
 * @param offScreenThreshold_percent feet lower than this (% of height) are not tracked
 */
const readPlayers = async (segmentation: Segmentation, offScreenThreshold_percent?: number): Promise<PlayerFrame[]> => {
  const players: PlayerFrame[] = [];
  for (let id = 0; id < segmentation.length; id++) {
    const mask = await segmentation[id].mask.toImageData();
    players.push({ id, mask, feet: findFeet(mask, mask.width, mask.height, offScreenThreshold_percent) });
  }
  return players;
};

/** The feet of the players that are on screen, keyed by player id. */
const feetPositionsOf = (players: PlayerFrame[]): FeetPositions => {
  const feetPositions: FeetPositions = {};
  for (const { id, feet } of players) {
    if (feet) feetPositions[id] = feet;
  }
  return feetPositions;
};

/**
 * Runs body segmentation on the webcam video every frame, draws the player's silhouette on a canvas,
 * and reports where each person's feet are.
 */
export default function CharacterCanvas({
  video,
  mediaStream,
  offScreenThreshold_percent,
  onFeetPositionsChange,
  onPlayersChange,
  canvasRef,
  className,
  style,
  maskType = "binary",
}: CharacterCanvasProps) {
  const net = useBodySegNet(mediaStream);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = canvasRef ?? internalCanvasRef;

  // Segment each video frame: report players and feet, then draw the mask
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const runSegmentationLoop = (net: BodySegNet, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const segmentOnce = async () => {
        const timestamp = performance.now();
        const segmentation = await net.segmentPeople(video, SEGMENTATION_CONFIG);
        if (cancelled) return; // the model may have been disposed while this frame was segmented
        const players = await readPlayers(segmentation, offScreenThreshold_percent);
        if (cancelled) return;
        onPlayersChange?.(players, timestamp);
        onFeetPositionsChange?.(feetPositionsOf(players));
        if (ctx) {
          // The 2D context is missing in some environments (eg. tests); the reports above still happen
          if (segmentation.length === 0) ctx.clearRect(0, 0, canvas.width, canvas.height);
          else await drawMask(video, segmentation, ctx, maskType);
        }
      };

      // A failed frame is skipped rather than ending the loop; only the first failure is logged, as it may repeat every frame
      let warned = false;
      const segmentFrame = async () => {
        if (cancelled) return;
        try {
          await segmentOnce();
        } catch (error) {
          if (!warned) console.warn("Skipped a camera frame that could not be segmented:", error);
          warned = true;
        }
        if (!cancelled) frame = requestAnimationFrame(segmentFrame);
      };

      segmentFrame();
    };

    // The stream belongs to CharacterCamera, which stops its tracks; this effect only stops its own loop
    const canvasElement = canvas.current;
    if (net && video && mediaStream && canvasElement) runSegmentationLoop(net, video, canvasElement);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [net, mediaStream, video, canvas, onFeetPositionsChange, onPlayersChange, offScreenThreshold_percent, maskType]);

  return <canvas ref={canvas} className={className} style={style} />;
}
