import { ImageSegmenter } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs";
import type { AppConfig } from "../../config/AppConfig";
import { FootstepsVisionModelImplementation } from "../FootstepsVisionModelImplementation";
import { splitMaskByNearestSkeleton, type Segment } from "../VisionQueries";
import {
  noKeyPoints,
  sourceSize,
  type Point,
  type VisionFrame,
  type VisionPerson,
  type VisionSource,
} from "../VisionTypes";
import { increasing, mediapipeWasm, SELFIE_SEGMENTER_MODEL_URL, silhouetteOf } from "./MediaPipeAssets";
import { headFromLandmarks, meanOf, partScale } from "./PoseGeometry";
import { selectTfBackend } from "./TfBackend";

// ponytail: loads from TF Hub (via Kaggle), as BodyPix's model does; self-host it if the game must run offline
/** MoveNet MultiPose Lightning, which finds up to 6 people. */
const MOVENET_URL = "https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1";

/** MoveNet's input: the longest side, in pixels, and the multiple both sides must be. */
const INPUT_SIZE = 256;
const INPUT_MULTIPLE = 32;

/** Each person's output row: 17 keypoints of (y, x, score), then a box (ymin, xmin, ymax, xmax, score). */
const KEYPOINTS = 17;
const ROW_LENGTH = 56;
const PERSON_SCORE = 55;

/** How confident MoveNet must be (0–1) in a person, and in each of their keypoints, for us to use them. */
const MIN_PERSON_SCORE = 0.25;
const MIN_KEYPOINT_SCORE = 0.3;

/** COCO keypoint indices (the person's own left and right). */
const K = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;

/** The limbs drawn between keypoints, for dividing the silhouette between people. */
const LIMBS: [number, number][] = [
  [K.nose, K.leftShoulder],
  [K.nose, K.rightShoulder],
  [K.leftShoulder, K.rightShoulder],
  [K.leftShoulder, K.leftElbow],
  [K.leftElbow, K.leftWrist],
  [K.rightShoulder, K.rightElbow],
  [K.rightElbow, K.rightWrist],
  [K.leftShoulder, K.leftHip],
  [K.rightShoulder, K.rightHip],
  [K.leftHip, K.rightHip],
  [K.leftHip, K.leftKnee],
  [K.leftKnee, K.leftAnkle],
  [K.rightHip, K.rightKnee],
  [K.rightKnee, K.rightAnkle],
];

/** How far past the wrist the hand's centre is, and past the ankle the foot's, as fractions of the forearm and shin. */
const HAND_BEYOND_WRIST = 0.3;
const FOOT_BEYOND_ANKLE = 0.15;

/** One person's keypoints in pixels, null where MoveNet isn't confident. */
type Pose = (Point | null)[];

/** The point a fraction of the way beyond `end`, along the line from `start`; `end` itself without a `start`. */
export const extrapolate = (start: Point | null, end: Point | null, beyond: number): Point | null => {
  if (!end) return null;
  if (!start) return end;
  return { x: end.x + beyond * (end.x - start.x), y: end.y + beyond * (end.y - start.y) };
};

/** The people in MoveNet's output, as keypoints in pixels of a frame of the given size. */
export const posesFromOutput = (output: ArrayLike<number>, width: number, height: number): Pose[] => {
  const poses: Pose[] = [];
  for (let row = 0; row + ROW_LENGTH <= output.length; row += ROW_LENGTH) {
    if (output[row + PERSON_SCORE] < MIN_PERSON_SCORE) continue;
    const pose: Pose = [];
    for (let k = 0; k < KEYPOINTS; k++) {
      const [y, x, score] = [output[row + k * 3], output[row + k * 3 + 1], output[row + k * 3 + 2]];
      pose.push(score >= MIN_KEYPOINT_SCORE ? { x: x * width, y: y * height } : null);
    }
    poses.push(pose);
  }
  return poses;
};

/** One pose's key points, and the radius of its hands and feet. */
export const keyPointsOfPose = (pose: Pose, height: number): Pick<VisionPerson, "keyPoints" | "scale"> => {
  const eyes = meanOf([pose[K.leftEye], pose[K.rightEye]].filter((point): point is Point => point !== null));
  const { head, width: headWidth } = headFromLandmarks(pose[K.leftEar], pose[K.rightEar], eyes);
  return {
    keyPoints: {
      ...noKeyPoints(),
      ...head,
      leftHand: extrapolate(pose[K.leftElbow], pose[K.leftWrist], HAND_BEYOND_WRIST),
      rightHand: extrapolate(pose[K.rightElbow], pose[K.rightWrist], HAND_BEYOND_WRIST),
      leftFoot: extrapolate(pose[K.leftKnee], pose[K.leftAnkle], FOOT_BEYOND_ANKLE),
      rightFoot: extrapolate(pose[K.rightKnee], pose[K.rightAnkle], FOOT_BEYOND_ANKLE),
    },
    scale: partScale(headWidth, height),
  };
};

/** A pose's limbs between confident keypoints, or its lone keypoints if no limb is whole. */
export const skeletonOf = (pose: Pose): Segment[] => {
  const limbs = LIMBS.flatMap(([a, b]): Segment[] => {
    const [start, end] = [pose[a], pose[b]];
    return start && end ? [[start, end]] : [];
  });
  return limbs.length > 0 ? limbs : pose.flatMap((point): Segment[] => (point ? [[point, point]] : []));
};

/** MoveNet's input size for a frame: the longest side {@link INPUT_SIZE}, both sides a multiple of 32. */
const inputSize = (width: number, height: number): [number, number] => {
  const scale = INPUT_SIZE / Math.max(width, height);
  const round = (side: number) =>
    Math.max(INPUT_MULTIPLE, Math.round((side * scale) / INPUT_MULTIPLE) * INPUT_MULTIPLE);
  return [round(height), round(width)];
};

/** Each person's keypoints, as fractions of the frame's width and height. */
const estimatePoses = async (movenet: tf.GraphModel, source: VisionSource): Promise<Pose[]> => {
  const input = tf.tidy(() => {
    const frame = tf.browser.fromPixels(source);
    const [height, width] = frame.shape;
    return tf.image.resizeBilinear(frame, inputSize(width, height)).toInt().expandDims(0);
  });
  const output = movenet.predict(input);
  try {
    if (!(output instanceof tf.Tensor)) throw new Error("MoveNet gave more than one output");
    return posesFromOutput(await output.data(), 1, 1);
  } finally {
    tf.dispose([input, output]);
  }
};

/**
 * MoveNet MultiPose (tfjs) for each person's keypoints, with MediaPipe's selfie segmenter for everyone's silhouette,
 * which is divided between people by whose skeleton each pixel is nearest.
 */
export class MoveNetModel extends FootstepsVisionModelImplementation {
  private readonly config: AppConfig;
  private movenet: tf.GraphModel | null = null;
  private segmenter: ImageSegmenter | null = null;
  private lastTimestamp = -Infinity;

  /** @param config the tfjs backend, and how many people to look for */
  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  async load(): Promise<void> {
    await selectTfBackend(this.config.visionBackend);
    const [movenet, segmenter] = await Promise.all([
      tf.loadGraphModel(MOVENET_URL, { fromTFHub: true }),
      mediapipeWasm().then((wasm) =>
        ImageSegmenter.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: SELFIE_SEGMENTER_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      ),
    ]);
    [this.movenet, this.segmenter] = [movenet, segmenter];
  }

  async detect(source: VisionSource, timestamp: number): Promise<VisionFrame> {
    if (!this.movenet || !this.segmenter) throw new Error("MoveNet is not loaded");
    const poses = (await estimatePoses(this.movenet, source)).slice(0, this.config.visionMaxPeople);

    this.lastTimestamp = increasing(timestamp, this.lastTimestamp);
    const masks = this.segmenter.segmentForVideo(source, this.lastTimestamp).confidenceMasks ?? [];
    try {
      const [mask] = masks;
      const { width, height } = mask ?? sourceSize(source);
      const silhouette = mask ? silhouetteOf(mask.getAsFloat32Array()) : new Uint8Array(width * height);
      const scaled = poses.map((pose) => pose.map((point) => point && { x: point.x * width, y: point.y * height }));
      const split = splitMaskByNearestSkeleton(silhouette, width, scaled.map(skeletonOf));
      const people = scaled.map((pose, id) => ({ id, mask: split[id], ...keyPointsOfPose(pose, height) }));
      return { width, height, timestamp, people };
    } finally {
      for (const confidence of masks) confidence.close();
    }
  }

  dispose(): void {
    this.movenet?.dispose();
    this.segmenter?.close();
    [this.movenet, this.segmenter] = [null, null];
  }
}
