import * as bodySeg from "@tensorflow-models/body-segmentation";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";
import { drawMask } from "./BodySegSupport";
import { findFeet, type FeetPositions } from "./CameraSupport";

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

/**
 * Finds each segmented person's feet, keyed by their index in the segmentation.
 * @param offScreenThreshold_percent feet lower than this (% of height) are not tracked
 */
const findAllFeet = async (segmentation: Segmentation, offScreenThreshold_percent?: number): Promise<FeetPositions> => {
  const feetPositions: FeetPositions = {};
  for (let i = 0; i < segmentation.length; i++) {
    const personMask = await bodySeg.toBinaryMask(
      [segmentation[i]],
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 0, g: 0, b: 0, a: 0 },
    );
    const feet = findFeet(personMask, personMask.width, personMask.height, offScreenThreshold_percent);
    if (feet) {
      feetPositions[i] = feet;
    }
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
  className,
  style,
  maskType = "binary",
}: CharacterCanvasProps) {
  const [net, setNet] = useState<BodySegNet | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load the model while there is a camera stream, and release it when there isn't
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

  // Segment each video frame: report feet positions, then draw the mask
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const runSegmentationLoop = (net: BodySegNet, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const segmentFrame = async () => {
        if (cancelled) return;
        const segmentation = await net.segmentPeople(video, SEGMENTATION_CONFIG);
        if (cancelled) return; // the model may have been disposed while this frame was segmented
        if (segmentation.length === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          onFeetPositionsChange?.({});
        } else {
          if (onFeetPositionsChange) onFeetPositionsChange(await findAllFeet(segmentation, offScreenThreshold_percent));
          await drawMask(video, segmentation, ctx, maskType);
        }
        frame = requestAnimationFrame(segmentFrame);
      };

      segmentFrame();
    };

    // The stream belongs to CharacterCamera, which stops its tracks; this effect only stops its own loop
    if (net && video && mediaStream) runSegmentationLoop(net, video, canvasRef.current!);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [net, mediaStream, video, onFeetPositionsChange, offScreenThreshold_percent, maskType]);

  return <canvas ref={canvasRef} className={className} style={style} />;
}
