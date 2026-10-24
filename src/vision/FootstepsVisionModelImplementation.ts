import { bodyPartsAt, bodyPartsIn, type BodyPartAtPoint, type BodyPartInArea } from "./VisionQueries";
import type { PixelRect, Point, VisionFrame, VisionSource } from "./VisionTypes";

/**
 * A vision model that finds players in camera frames, whatever library runs it.
 *
 * Each implementation gives the same result: a silhouette mask and key points per person, in our own body parts.
 * The queries work on any frame, so they also answer for frames a worker produced.
 */
export abstract class FootstepsVisionModelImplementation {
  /** Loads the model; resolves once it can detect. */
  abstract load(): Promise<void>;

  /**
   * Finds the people in one frame.
   * @param source the camera frame
   * @param timestamp when the frame was taken, in milliseconds
   */
  abstract detect(source: VisionSource, timestamp: number): Promise<VisionFrame>;

  /** Releases the model and anything it holds on the GPU. */
  abstract dispose(): void;

  /** The body parts, of anyone, at a point in mask pixels. */
  bodyPartsAt(frame: VisionFrame, point: Point): BodyPartAtPoint[] {
    return bodyPartsAt(frame, point);
  }

  /** The body parts, of anyone, inside an area in mask pixels, and the fraction of each that is inside. */
  bodyPartsIn(frame: VisionFrame, area: PixelRect): BodyPartInArea[] {
    return bodyPartsIn(frame, area);
  }
}
