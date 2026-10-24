import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs";
import type { AppConfig } from "../../config/AppConfig";
import { FootstepsVisionModelImplementation } from "../FootstepsVisionModelImplementation";
import { noKeyPoints, type KeyPoints, type VisionFrame, type VisionPerson, type VisionSource } from "../VisionTypes";

/** BodyPix's part ids (see its `PART_CHANNELS`) for the parts we find key points from. */
const PART_IDS = { leftFace: 0, rightFace: 1, leftHand: 10, rightHand: 11, leftFoot: 22, rightFoot: 23 } as const;

/** A hand or foot's radius, as a fraction of the head's width. */
const PART_RADIUS_PER_HEAD_WIDTH = 0.4;

/** A hand or foot's radius when there is no head to measure, as a fraction of the frame height. */
const FALLBACK_RADIUS_PER_HEIGHT = 0.03;

/** Running totals for the centroid of one part's pixels. */
interface Centroid {
  x: number;
  y: number;
  count: number;
}

/** The extent of the face pixels. */
interface Extent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** A centroid's mean, or null if it has no pixels. */
const meanOf = ({ x, y, count }: Centroid): KeyPoints["leftHand"] =>
  count === 0 ? null : { x: Math.round(x / count), y: Math.round(y / count) };

/**
 * Turns one BodyPix part segmentation into a person: a silhouette, and key points from the part pixels.
 *
 * One pass over the pixels builds the mask, the hand and foot centroids, and the face's extent.
 */
export const personFromParts = (id: number, { data, width, height }: bodyPix.PartSegmentation): VisionPerson => {
  const mask = new Uint8Array(width * height);
  const centroids = {
    leftHand: { x: 0, y: 0, count: 0 },
    rightHand: { x: 0, y: 0, count: 0 },
    leftFoot: { x: 0, y: 0, count: 0 },
    rightFoot: { x: 0, y: 0, count: 0 },
  };
  const byPart: Partial<Record<number, Centroid>> = {
    [PART_IDS.leftHand]: centroids.leftHand,
    [PART_IDS.rightHand]: centroids.rightHand,
    [PART_IDS.leftFoot]: centroids.leftFoot,
    [PART_IDS.rightFoot]: centroids.rightFoot,
  };
  const face: Extent = { minX: width, maxX: -1, minY: height, maxY: -1 };

  for (let i = 0; i < data.length; i++) {
    const part = data[i];
    if (part < 0) continue; // background
    mask[i] = 1;
    const x = i % width;
    const y = (i - x) / width;
    const centroid = byPart[part];
    if (centroid) {
      centroid.x += x;
      centroid.y += y;
      centroid.count++;
    } else if (part === PART_IDS.leftFace || part === PART_IDS.rightFace) {
      face.minX = Math.min(face.minX, x);
      face.maxX = Math.max(face.maxX, x);
      face.minY = Math.min(face.minY, y);
      face.maxY = Math.max(face.maxY, y);
    }
  }

  const keyPoints: KeyPoints = {
    ...noKeyPoints(),
    leftHand: meanOf(centroids.leftHand),
    rightHand: meanOf(centroids.rightHand),
    leftFoot: meanOf(centroids.leftFoot),
    rightFoot: meanOf(centroids.rightFoot),
  };
  let scale = FALLBACK_RADIUS_PER_HEIGHT * height;
  if (face.maxX >= 0) {
    const midX = Math.round((face.minX + face.maxX) / 2);
    const midY = Math.round((face.minY + face.maxY) / 2);
    // The person faces the camera, so their own left is the image's right
    keyPoints.headTop = { x: midX, y: face.minY };
    keyPoints.headBottom = { x: midX, y: face.maxY };
    keyPoints.headLeft = { x: face.maxX, y: midY };
    keyPoints.headRight = { x: face.minX, y: midY };
    scale = PART_RADIUS_PER_HEAD_WIDTH * (face.maxX - face.minX + 1);
  }
  return { id, mask, keyPoints, scale };
};

/** BodyPix on tfjs: segments each person into body parts, from which we take the silhouette and key points. */
export class BodyPixModel extends FootstepsVisionModelImplementation {
  private readonly config: AppConfig;
  private net: bodyPix.BodyPix | null = null;

  /** @param config the BodyPix settings, and how many people to look for */
  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  async load(): Promise<void> {
    await tf.ready();
    const { bodypixArchitecture: architecture, bodypixOutputStride, bodypixQuantBytes: quantBytes } = this.config;
    // ResNet50 only has strides 16 and 32, and only a multiplier of 1
    const outputStride = architecture === "ResNet50" && bodypixOutputStride === 8 ? 16 : bodypixOutputStride;
    const multiplier = architecture === "ResNet50" ? 1 : 0.75;
    this.net = await bodyPix.load({ architecture, outputStride, multiplier, quantBytes });
  }

  async detect(source: VisionSource, timestamp: number): Promise<VisionFrame> {
    if (!this.net) throw new Error("BodyPix is not loaded");
    // BodyPix reads a video directly; a bitmap (from a worker) goes in as a tensor
    const isVideo = "videoWidth" in source;
    const input = isVideo ? source : tf.browser.fromPixels(source);
    try {
      const segmentations = await this.net.segmentMultiPersonParts(input, {
        internalResolution: this.config.bodypixInternalResolution,
        segmentationThreshold: this.config.bodypixThreshold,
        maxDetections: this.config.visionMaxPeople,
      });
      const people = segmentations.map((segmentation, id) => personFromParts(id, segmentation));
      return isVideo
        ? { width: source.videoWidth, height: source.videoHeight, timestamp, people }
        : { width: source.width, height: source.height, timestamp, people };
    } finally {
      if (input instanceof tf.Tensor) input.dispose();
    }
  }

  dispose(): void {
    this.net?.dispose();
    this.net = null;
  }
}
