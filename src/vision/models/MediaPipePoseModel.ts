import { PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { AppConfig } from "../../config/AppConfig";
import { FootstepsVisionModelImplementation } from "../FootstepsVisionModelImplementation";
import {
  noKeyPoints,
  type KeyPoints,
  type VisionFrame,
  type VisionPerson,
  type VisionSource,
  sourceSize,
} from "../VisionTypes";
import { increasing, mediapipeWasm, poseLandmarkerModelUrl, silhouetteOf } from "./MediaPipeAssets";
import { headFromLandmarks, meanOf, partScale } from "./PoseGeometry";

/** BlazePose's landmark indices (the person's own left and right) for the parts we place. */
const LANDMARKS = {
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftHand: [15, 17, 19, 21], // wrist, pinky, index, thumb
  rightHand: [16, 18, 20, 22],
  leftFoot: [27, 29, 31], // ankle, heel, toe
  rightFoot: [28, 30, 32],
} as const;

/** How visible (0–1) a landmark must be for us to use it. */
const MIN_VISIBILITY = 0.5;

/** The visible landmarks among the given indices, in pixels. */
const visiblePoints = (pose: NormalizedLandmark[], indices: readonly number[], width: number, height: number) =>
  indices
    .map((index) => pose[index])
    .filter((landmark) => landmark && (landmark.visibility ?? 1) >= MIN_VISIBILITY)
    .map(({ x, y }) => ({ x: x * width, y: y * height }));

/** The mean of the visible landmarks among the given indices, or null if none are visible. */
const meanPoint = (pose: NormalizedLandmark[], indices: readonly number[], width: number, height: number) =>
  meanOf(visiblePoints(pose, indices, width, height));

/** One pose's key points, in pixels, and the radius of its hands and feet. */
export const keyPointsOfPose = (
  pose: NormalizedLandmark[],
  width: number,
  height: number,
): Pick<VisionPerson, "keyPoints" | "scale"> => {
  const [leftEar] = visiblePoints(pose, [LANDMARKS.leftEar], width, height);
  const [rightEar] = visiblePoints(pose, [LANDMARKS.rightEar], width, height);
  const eyes = meanPoint(pose, [LANDMARKS.leftEye, LANDMARKS.rightEye], width, height);
  const { head, width: headWidth } = headFromLandmarks(leftEar ?? null, rightEar ?? null, eyes);
  const keyPoints: KeyPoints = {
    ...noKeyPoints(),
    ...head,
    leftHand: meanPoint(pose, LANDMARKS.leftHand, width, height),
    rightHand: meanPoint(pose, LANDMARKS.rightHand, width, height),
    leftFoot: meanPoint(pose, LANDMARKS.leftFoot, width, height),
    rightFoot: meanPoint(pose, LANDMARKS.rightFoot, width, height),
  };
  return { keyPoints, scale: partScale(headWidth, height) };
};

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
      const size = sourceSize(source);
      const width = masks[0]?.width ?? size.width;
      const height = masks[0]?.height ?? size.height;
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
