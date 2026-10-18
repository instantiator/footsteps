import * as bodySeg from "@tensorflow-models/body-segmentation";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";
import { drawMask } from "./BodySegSupport";
import { findFeet, type FeetPositions } from "./CameraSupport";

type BodySegNet = bodySeg.BodySegmenter;
type Segmentation = Awaited<ReturnType<BodySegNet["segmentPeople"]>>;

interface CharacterCanvasProps {
  video: HTMLVideoElement | null;
  mediaStream: MediaStream | undefined;
  offScreenThreshold_percent?: number;
  onFeetPositionsChange?: (feetPositions: FeetPositions) => void;
  className?: string;
  style?: React.CSSProperties;
  maskType?: "binary" | "colored" | "extremities";
}

/** BodyPix on ResNet50, for accuracy over speed. */
const MODEL_CONFIG: bodySeg.BodyPixModelConfig = {
  architecture: "ResNet50",
  outputStride: 32,
  multiplier: 1.0, // Use 1.0 for ResNet50
  quantBytes: 4,
};

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
    const runSegmentationLoop = (net: BodySegNet, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const segmentFrame = async () => {
        const segmentation = await net.segmentPeople(video, SEGMENTATION_CONFIG);
        if (segmentation.length === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          onFeetPositionsChange?.({});
        } else {
          if (onFeetPositionsChange) onFeetPositionsChange(await findAllFeet(segmentation, offScreenThreshold_percent));
          await drawMask(video, segmentation, ctx, maskType);
        }
        requestAnimationFrame(segmentFrame);
      };

      segmentFrame();
    };

    if (net && video && mediaStream) {
      runSegmentationLoop(net, video, canvasRef.current!);
      return () => {
        mediaStream.getTracks().forEach((track) => track.stop());
      };
    }
  }, [net, mediaStream, video, onFeetPositionsChange, offScreenThreshold_percent, maskType]);

  return <canvas ref={canvasRef} className={className} style={style} />;
}
