import { useCallback, useEffect, useRef, useState } from "react";
import { loadCameraChoice, saveCameraChoice, sizeOf, type CameraChoice } from "../camera/CameraChoice";
import { getCameraStream, stopTracks } from "../camera/CameraSupport";
import { cameraOptionsFor, type CameraOption } from "../camera/Webcams";

/** The cameras the browser lists, which it only names once the camera permission is granted. */
const listCameras = async (): Promise<MediaDeviceInfo[]> =>
  (await navigator.mediaDevices.enumerateDevices()).filter(({ kind }) => kind === "videoinput");

/** The camera a stream is really using. */
const deviceIdOf = (stream: MediaStream | undefined): string | undefined =>
  stream?.getTracks()[0]?.getSettings().deviceId;

/** The sizes the stream's camera can be opened at, from its name and the largest picture the browser says it gives. */
const optionsOf = (cameras: MediaDeviceInfo[], stream: MediaStream | undefined): CameraOption[] => {
  const track = stream?.getVideoTracks()[0];
  if (!track) return [];
  const label = cameras.find((camera) => camera.deviceId === deviceIdOf(stream))?.label ?? "";
  const { width, height } = "getCapabilities" in track ? track.getCapabilities() : {};
  return cameraOptionsFor(label, { width: width?.max, height: height?.max });
};

/**
 * Calls back when the cameras may have changed. Used only on the landing page, as play stays on its camera. Focus
 * counts, as browsers may not report a new default camera when no camera came or went.
 */
const useCameraChanges = (onChange: () => void) => {
  useEffect(() => {
    if (!("mediaDevices" in navigator)) return;
    const { mediaDevices } = navigator;
    mediaDevices.addEventListener("devicechange", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [onChange]);
};

/** The player's camera choice, the cameras to choose from, and a live stream from the chosen one. */
interface CameraPicker {
  /** What the player has chosen. */
  choice: CameraChoice;
  /** Changes and saves part of the choice. */
  choose: (change: Partial<CameraChoice>) => void;
  /** The cameras the browser lists. */
  cameras: MediaDeviceInfo[];
  /** The live stream from the chosen camera, once it has started. */
  stream: MediaStream | undefined;
  /** Whether the chosen camera couldn't start. */
  failed: boolean;
  /** The camera the stream is really using, which may be the system default. */
  activeDeviceId: string | undefined;
  /** The picture sizes the camera in use can be opened at. */
  options: CameraOption[];
}

/** The player's saved camera choice, and a way to change and save part of it. */
const useCameraChoice = () => {
  const [choice, setChoice] = useState(loadCameraChoice);
  const choose = useCallback((change: Partial<CameraChoice>) => {
    setChoice((current) => {
      const next = { ...current, ...change };
      saveCameraChoice(next);
      return next;
    });
  }, []);
  return { choice, choose };
};

/** Holds the player's camera choice, keeps a live stream from it, and follows changes in the system's cameras. */
export const useCameraPicker = (): CameraPicker => {
  const { choice, choose } = useCameraChoice();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream>();
  const [failed, setFailed] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  // Browsers name no default camera, but list it first, so a new first camera means the default changed
  const firstCameraRef = useRef<string>(undefined);

  const { deviceId } = choice;
  const { width, height } = sizeOf(choice);

  useEffect(() => {
    let cancelled = false;
    let opened: MediaStream | undefined;
    const open = async () => {
      opened = await getCameraStream({ width, height }, deviceId);
      if (cancelled) return stopTracks(opened);
      setStream(opened);
      setFailed(false);
      const listed = await listCameras();
      if (cancelled) return;
      setCameras(listed);
      firstCameraRef.current = listed[0]?.deviceId;
    };
    open().catch(() => {
      if (cancelled) return;
      setStream(undefined);
      setFailed(true);
    });
    return () => {
      cancelled = true;
      if (opened) stopTracks(opened);
    };
  }, [deviceId, width, height, openCount]);

  const refresh = useCallback(() => {
    listCameras()
      .then((listed) => {
        setCameras(listed);
        const isListed = (id: string | undefined) => listed.some((camera) => camera.deviceId === id);
        if (deviceId !== undefined) {
          if (!isListed(deviceId)) choose({ deviceId: undefined, size: undefined });
          return;
        }
        const firstChanged = listed[0]?.deviceId !== firstCameraRef.current;
        const activeGone = stream !== undefined && !isListed(deviceIdOf(stream));
        firstCameraRef.current = listed[0]?.deviceId;
        if (firstChanged || activeGone) setOpenCount((count) => count + 1);
      })
      .catch((error: unknown) => console.warn("Could not list the cameras:", error));
  }, [deviceId, stream, choose]);
  useCameraChanges(refresh);

  return {
    choice,
    choose,
    cameras,
    stream,
    failed,
    activeDeviceId: deviceIdOf(stream),
    options: optionsOf(cameras, stream),
  };
};
