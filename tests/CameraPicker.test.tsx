import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCameraChoice, saveCameraChoice } from "../src/components/camera/CameraChoice";
import { cameraKeyOf, isCalibrated, loadCalibration, saveCalibration } from "../src/components/camera/FloorCalibration";
import { DEFAULT_CORNERS } from "../src/components/camera/FloorGeometry";
import CameraPicker from "../src/components/landing/CameraPicker";
import { FakeMediaStream, FakeMediaStreamTrack } from "./helpers/media";
import { stubGetUserMedia } from "./helpers/permissions";

/** A camera as the browser lists it. */
const device = (deviceId: string, label: string): MediaDeviceInfo => ({
  deviceId,
  label,
  kind: "videoinput",
  groupId: "group",
  toJSON: () => ({}),
});

const LAPTOP = device("laptop", "Laptop camera");

/** A floor narrower at the front than the default. */
const NARROW = { ...DEFAULT_CORNERS, frontLeft: { x: 0.2, y: 0.85 }, frontRight: { x: 0.8, y: 0.85 } };
const LIFECAM = device("lifecam", "Microsoft® LifeCam HD-3000 (045e:0810)");
const REAR = device("rear", "Rear camera");

let camera: ReturnType<typeof stubGetUserMedia>;
let tracks: FakeMediaStreamTrack[];

/** Makes the stubbed camera open the asked-for device, or else the given default. */
const opensDevices = (defaultCamera: () => string) => {
  camera.getUserMedia.mockImplementation(({ video }) => {
    const exact = typeof video === "object" && typeof video.deviceId === "object" && "exact" in video.deviceId;
    const asked = exact ? String((video.deviceId as ConstrainDOMStringParameters).exact) : defaultCamera();
    const track = new FakeMediaStreamTrack({ deviceId: asked });
    tracks.push(track);
    return Promise.resolve(new FakeMediaStream([track]));
  });
};

const sizes = () => screen.queryByRole<HTMLSelectElement>("combobox", { name: "Configuration" });

const dropdown = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Camera" });

beforeEach(() => {
  localStorage.clear();
  tracks = [];
  camera = stubGetUserMedia();
  camera.enumerateDevices.mockResolvedValue([LAPTOP, REAR]);
  opensDevices(() => "laptop");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  camera.restore();
  vi.restoreAllMocks();
});

describe("CameraPicker", () => {
  it("lists the system default and every camera, with the default marked", async () => {
    render(<CameraPicker />);

    expect(await screen.findByRole("option", { name: "Rear camera" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "✓ System default (Laptop camera)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Laptop camera" })).toBeInTheDocument();
    expect(dropdown().value).toBe("");
  });

  it("marks and opens the chosen camera, saves it, and stops the one before", async () => {
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });

    fireEvent.change(dropdown(), { target: { value: "rear" } });

    expect(await screen.findByRole("option", { name: "✓ Rear camera" })).toBeInTheDocument();
    expect(loadCameraChoice().deviceId).toBe("rear");
    expect(camera.getUserMedia).toHaveBeenLastCalledWith({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, deviceId: { exact: "rear" } },
    });
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("starts with a saved camera", async () => {
    saveCameraChoice({ deviceId: "rear", mirror: false });
    render(<CameraPicker />);

    expect(await screen.findByRole("option", { name: "✓ Rear camera" })).toBeInTheDocument();
  });

  it("reopens when the system default changes, while following it", async () => {
    let defaultCamera = "laptop";
    opensDevices(() => defaultCamera);
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "✓ System default (Laptop camera)" });

    defaultCamera = "rear";
    camera.enumerateDevices.mockResolvedValue([REAR, LAPTOP]);
    act(() => void camera.changeDevices());

    expect(await screen.findByRole("option", { name: "✓ System default (Rear camera)" })).toBeInTheDocument();
    expect(camera.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("notices a new default when the page regains focus", async () => {
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });

    camera.enumerateDevices.mockResolvedValue([REAR, LAPTOP]);
    act(() => void window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(camera.getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("doesn't reopen when nothing changed", async () => {
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });

    await act(async () => {
      camera.changeDevices();
      await Promise.resolve();
    });

    expect(camera.getUserMedia).toHaveBeenCalledOnce();
  });

  it("stays on a chosen camera when the default changes", async () => {
    saveCameraChoice({ deviceId: "rear", mirror: false });
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "✓ Rear camera" });

    camera.enumerateDevices.mockResolvedValue([REAR, LAPTOP]);
    await act(async () => {
      camera.changeDevices();
      await Promise.resolve();
    });

    expect(camera.getUserMedia).toHaveBeenCalledOnce();
    expect(dropdown().value).toBe("rear");
  });

  it("falls back to the default when the chosen camera is unplugged", async () => {
    saveCameraChoice({ deviceId: "rear", mirror: false });
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "✓ Rear camera" });

    camera.enumerateDevices.mockResolvedValue([LAPTOP]);
    act(() => void camera.changeDevices());

    expect(await screen.findByRole("option", { name: "✓ System default (Laptop camera)" })).toBeInTheDocument();
    expect(loadCameraChoice().deviceId).toBeUndefined();
  });

  it("saves the mirror setting, and flips the preview with it", async () => {
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });
    const preview = screen.getByLabelText("Camera preview");
    expect(preview).not.toHaveStyle({ transform: "scaleX(-1)" });

    fireEvent.click(screen.getByRole("checkbox", { name: /Mirror picture/ }));

    expect(preview).toHaveStyle({ transform: "scaleX(-1)" });
    expect(loadCameraChoice().mirror).toBe(true);
  });

  it("says when the camera can't start", async () => {
    camera.getUserMedia.mockRejectedValue(new DOMException("busy", "NotReadableError"));
    render(<CameraPicker />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not start");
  });

  it("turns the camera off when it goes away", async () => {
    const { unmount } = render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });

    unmount();

    expect(tracks[0].stop).toHaveBeenCalled();
  });
});

describe("loadCameraChoice", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to the system camera, unmirrored", () => {
    expect(loadCameraChoice()).toEqual({ mirror: false });
  });

  it.each(["not json", "null", "[]", '{"deviceId":5,"mirror":"yes"}'])("ignores a bad saved value: %s", (value) => {
    localStorage.setItem("footsteps:camera-choice", value);
    expect(loadCameraChoice()).toMatchObject({ mirror: false });
    expect(loadCameraChoice().deviceId).toBeUndefined();
  });

  it("keeps a saved size, and ignores one that isn't a size", () => {
    saveCameraChoice({ size: { width: 640, height: 480 }, mirror: false });
    expect(loadCameraChoice().size).toEqual({ width: 640, height: 480 });
    localStorage.setItem("footsteps:camera-choice", '{"size":{"width":0,"height":"480"},"mirror":false}');
    expect(loadCameraChoice().size).toBeUndefined();
  });
});

describe("the configuration choice", () => {
  it("offers a known camera's configurations, and reopens it at the chosen one", async () => {
    camera.enumerateDevices.mockResolvedValue([LIFECAM, REAR]);
    opensDevices(() => "lifecam");
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "HD (1280×720)" });

    fireEvent.change(sizes() ?? dropdown(), { target: { value: "640x480" } });

    await waitFor(() =>
      expect(camera.getUserMedia).toHaveBeenLastCalledWith({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      }),
    );
    expect(loadCameraChoice().size).toEqual({ width: 640, height: 480 });
  });

  it("goes back to the configured size when the camera changes", async () => {
    saveCameraChoice({ size: { width: 640, height: 480 }, mirror: false });
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });

    fireEvent.change(dropdown(), { target: { value: "rear" } });

    await waitFor(() => expect(loadCameraChoice()).toEqual({ deviceId: "rear", size: undefined, mirror: false }));
  });

  it("isn't shown when the camera can give only one size", async () => {
    vi.spyOn(FakeMediaStreamTrack.prototype, "getCapabilities").mockReturnValue({
      width: { max: 640 },
      height: { max: 480 },
    });
    render(<CameraPicker />);
    await screen.findByRole("option", { name: "Rear camera" });
    expect(sizes()).toBeNull();
  });
});

describe("the floor buttons and warnings", () => {
  const renderPicker = (props: ComponentProps<typeof CameraPicker> = {}) =>
    render(
      <MemoryRouter>
        <CameraPicker calibrateTo="/calibrate" {...props} />
      </MemoryRouter>,
    );

  it("shows what's still needed over the preview", () => {
    renderPicker({ granted: false, warnings: ["Camera required"] });
    expect(screen.getByText("Camera required").closest(".game-camera-preview")).not.toBeNull();
    expect(camera.getUserMedia).not.toHaveBeenCalled();
  });

  it("clears only the chosen configuration's floor", async () => {
    const sd = cameraKeyOf({ size: { width: 640, height: 480 } });
    saveCalibration(cameraKeyOf({}), NARROW);
    saveCalibration(sd, NARROW);
    const onCalibrationChange = vi.fn();
    renderPicker({ onCalibrationChange });
    await screen.findByRole("option", { name: "Rear camera" });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onCalibrationChange).toHaveBeenCalledOnce();
    expect(isCalibrated(cameraKeyOf({}))).toBe(false);
    expect(isCalibrated(sd)).toBe(true);
  });

  it("resets the chosen configuration's floor to the default floor", async () => {
    saveCalibration(cameraKeyOf({}), NARROW);
    const onCalibrationChange = vi.fn();
    renderPicker({ onCalibrationChange });
    await screen.findByRole("option", { name: "Rear camera" });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onCalibrationChange).toHaveBeenCalledOnce();
    expect(loadCalibration(cameraKeyOf({}))).toEqual(DEFAULT_CORNERS);
  });

  it("tells the landing page which camera is in use, and at what size", async () => {
    const onCameraChange = vi.fn();
    renderPicker({ onCameraChange });
    await waitFor(() =>
      expect(onCameraChange).toHaveBeenLastCalledWith({
        key: "default@1280x720",
        label: "Laptop camera",
        size: { width: 1280, height: 720 },
      }),
    );
  });
});

describe("the preview's buttons", () => {
  it("are Reset, Clear and Calibrate, in that order, under the preview", () => {
    render(
      <MemoryRouter>
        <CameraPicker calibrateTo="/calibrate" />
      </MemoryRouter>,
    );
    const buttons = document.querySelectorAll(".game-camera-floor-actions > *");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Reset", "Clear", "Calibrate"]);
    expect(screen.queryByRole("button", { name: "Clear all calibrations" })).toBeNull();
  });

  it("start with the picture unmirrored, for a camera behind the player", () => {
    render(<CameraPicker />);
    expect(screen.getByRole("checkbox", { name: /Mirror picture/ })).not.toBeChecked();
  });
});
