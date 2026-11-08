import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feetOf, getCameraStream } from "../src/components/camera/CameraSupport";
import { FakeMediaStream } from "./helpers/media";
import { stubGetUserMedia } from "./helpers/permissions";
import { noKeyPoints, type Point } from "../src/vision/VisionTypes";

const WIDTH = 10;
const HEIGHT = 100;

/** A person with only the given feet placed. */
const withFeet = (leftFoot: Point | null, rightFoot: Point | null) => ({
  keyPoints: { ...noKeyPoints(), leftFoot, rightFoot },
});

describe("feetOf", () => {
  it("returns null when neither foot was placed", () => {
    expect(feetOf(withFeet(null, null), WIDTH, HEIGHT)).toBeNull();
  });

  it("is midway between the feet, at the lower foot's height", () => {
    const feet = feetOf(withFeet({ x: 2, y: 48 }, { x: 6, y: 50 }), WIDTH, HEIGHT);
    expect(feet).toEqual({ absolute: { x: 4, y: 50 }, percent: { x: 40, y: 50 } });
  });

  it("uses the one foot that was placed", () => {
    expect(feetOf(withFeet(null, { x: 5, y: 0 }), WIDTH, HEIGHT)?.absolute).toEqual({ x: 5, y: 0 });
  });

  it("returns null when the feet are below the off-screen threshold", () => {
    expect(feetOf(withFeet({ x: 5, y: 95 }, null), WIDTH, HEIGHT, 90)).toBeNull();
    expect(feetOf(withFeet({ x: 5, y: 85 }, null), WIDTH, HEIGHT, 90)?.absolute.y).toBe(85);
  });

  it("returns null for a frame with no size", () => {
    expect(feetOf(withFeet({ x: 0, y: 0 }, null), 0, 0)).toBeNull();
  });
});

describe("getCameraStream", () => {
  let camera: ReturnType<typeof stubGetUserMedia>;

  beforeEach(() => {
    camera = stubGetUserMedia();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    camera.restore();
    vi.restoreAllMocks();
  });

  it("asks for the chosen camera and no other", async () => {
    await getCameraStream({ width: 640, height: 480 }, "rear");
    expect(camera.getUserMedia).toHaveBeenCalledExactlyOnceWith({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, deviceId: { exact: "rear" } },
    });
  });

  it("falls back to the system default when the chosen camera has gone", async () => {
    const stream = new FakeMediaStream();
    camera.getUserMedia.mockRejectedValueOnce(new DOMException("gone", "OverconstrainedError"));
    camera.getUserMedia.mockResolvedValueOnce(stream);
    await expect(getCameraStream(undefined, "rear")).resolves.toBe(stream);
    expect(camera.getUserMedia).toHaveBeenLastCalledWith({ video: true });
  });

  it("doesn't fall back to another camera when the chosen one is refused", async () => {
    camera.getUserMedia.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    await expect(getCameraStream(undefined, "rear")).rejects.toThrow("no");
    expect(camera.getUserMedia).toHaveBeenCalledOnce();
  });
});
