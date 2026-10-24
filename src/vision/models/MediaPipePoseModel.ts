import { PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { AppConfig } from "../../config/AppConfig";
import { FootstepsVisionModelImplementation } from "../FootstepsVisionModelImplementation";
import {
  noKeyPoints,
  type KeyPoints,
  type Point,
  type VisionFrame,
  type VisionPerson,
  type VisionSource,
} from "../VisionTypes";
import { increasing, mediapipeWasm, poseLandmarkerModelUrl, silhouetteOf } from "./MediaPipeAssets";

/** BlazePose's landmark indices (the person's own left and right) for the parts we place. */
const LANDMARKS = {
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHand: [15, 17, 19, 21], // wrist, pinky, index, thumb
  rightHand: [16, 18, 20, 22],
  leftFoot: [27, 29, 31], // ankle, heel, toe
  rightFoot: [28, 30, 32],
} as const;

/** How visible (0–1) a landmark must be for us to use it. */
const MIN_VISIBILITY = 0.5;

/** A hand or foot's radius, as a fraction of the head's width. */
const PART_RADIUS_PER_HEAD_WIDTH = 0.4;

/** A hand or foot's radius when there is no head to measure, as a fraction of the frame height. */
const FALLBACK_RADIUS_PER_HEIGHT = 0.03;

// ponytail: head proportions from typical anatomy, not measured from the mask; measure it if heads look off
/** The head's height, as a multiple of its width. */
const HEAD_HEIGHT_PER_WIDTH = 1.3;
/** How much of the head's height is above the eyes. */
const HEAD_ABOVE_EYES = 0.45;

/** The visible landmarks among the given indices, in pixels. */
const visiblePoints = (pose: NormalizedLandmark[], indices: readonly number[], width: number, height: number) =>
  indices
    .map((index) => pose[index])
    .filter((landmark) => landmark && (landmark.visibility ?? 1) >= MIN_VISIBILITY)
    .map(({ x, y }) => ({ x: x * width, y: y * height }));

/** The mean of the visible landmarks among the given indices, or null if none are visible. */
const meanPoint = (pose: NormalizedLandmark[], indices: readonly number[], width: number, height: number) => {
  const points = visiblePoints(pose, indices, width, height);
  if (points.length === 0) return null;
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

/** The head's extremes from its ears and eyes: the ears are its sides, and its height scales with its width. */
const headOf = (pose: NormalizedLandmark[], width: number, height: number): Partial<KeyPoints> & { width?: number } => {
  const [leftEar] = visiblePoints(pose, [LANDMARKS.leftEar], width, height);
  const [rightEar] = visiblePoints(pose, [LANDMARKS.rightEar], width, height);
  const eyes = meanPoint(pose, [LANDMARKS.leftEye, LANDMARKS.rightEye], width, height);
  if (!leftEar || !rightEar || !eyes) return {};

  const headWidth = Math.abs(leftEar.x - rightEar.x);
  const headHeight = HEAD_HEIGHT_PER_WIDTH * headWidth;
  const top = eyes.y - HEAD_ABOVE_EYES * headHeight;
  const side = (leftEar.y + rightEar.y) / 2;
  return {
    headTop: { x: eyes.x, y: top },
    headBottom: { x: eyes.x, y: top + headHeight },
    headLeft: { x: leftEar.x, y: side },
    headRight: { x: rightEar.x, y: side },
    width: headWidth,
  };
};

/** One pose's key points, in pixels, and the radius of its hands and feet. */
export const keyPointsOfPose = (
  pose: NormalizedLandmark[],
  width: number,
  height: number,
): Pick<VisionPerson, "keyPoints" | "scale"> => {
  const { width: headWidth, ...head } = headOf(pose, width, height);
  const keyPoints: KeyPoints = {
    ...noKeyPoints(),
    ...head,
    leftHand: meanPoint(pose, LANDMARKS.leftHand, width, height),
    rightHand: meanPoint(pose, LANDMARKS.rightHand, width, height),
    leftFoot: meanPoint(pose, LANDMARKS.leftFoot, width, height),
    rightFoot: meanPoint(pose, LANDMARKS.rightFoot, width, height),
  };
  const scale = headWidth ? PART_RADIUS_PER_HEAD_WIDTH * headWidth : FALLBACK_RADIUS_PER_HEIGHT * height;
  return { keyPoints, scale };
};

/** The pixel size of a video or bitmap. */
const sizeOf = (source: VisionSource): Point =>
  "videoWidth" in source ? { x: source.videoWidth, y: source.videoHeight } : { x: source.width, y: source.height };

/** MediaPipe Pose Landmarker: 33 landmarks and a segmentation mask per person, on the GPU. */
export class MediaPipePoseModel extends FootstepsVisionModelImplementation {
  private readonly config: AppConfig;
  private landmarker: PoseLandmarker | null = null;
  private lastTimestamp = -Infinity;

  /** @param config the model size, and how many people to look for */
  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  async load(): Promise<void> {
    this.landmarker = await PoseLandmarker.createFromOptions(await mediapipeWasm(), {
      baseOptions: { modelAssetPath: poseLandmarkerModelUrl(this.config.mediapipeVariant), delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: this.config.visionMaxPeople,
      outputSegmentationMasks: true,
    });
  }

  async detect(source: VisionSource, timestamp: number): Promise<VisionFrame> {
    if (!this.landmarker) throw new Error("MediaPipe Pose is not loaded");
    this.lastTimestamp = increasing(timestamp, this.lastTimestamp);
    const result = this.landmarker.detectForVideo(source, this.lastTimestamp);
    const masks = result.segmentationMasks ?? [];
    try {
      const size = sizeOf(source);
      const width = masks[0]?.width ?? size.x;
      const height = masks[0]?.height ?? size.y;
      const people = result.landmarks.map((pose, id) => ({
        id,
        mask: masks[id] ? silhouetteOf(masks[id].getAsFloat32Array()) : new Uint8Array(width * height),
        ...keyPointsOfPose(pose, width, height),
      }));
      return { width, height, timestamp, people };
    } finally {
      for (const mask of masks) mask.close();
    }
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
