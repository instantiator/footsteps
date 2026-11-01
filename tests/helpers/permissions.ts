import { vi } from "vitest";
import { FakeMediaStream } from "./media";

/** A PermissionStatus stand-in for jsdom, which has no Permissions API. */
export class FakePermissionStatus extends EventTarget implements PermissionStatus {
  readonly name: PermissionName;
  state: PermissionState;
  onchange = null;

  constructor(name: PermissionName, state: PermissionState) {
    super();
    this.name = name;
    this.state = state;
  }
}

/** What a stubbed camera permission query does: answer with a state, or reject as an unsupported name. */
export type PermissionQueryResult = PermissionState | "error";

/** Replaces `navigator.permissions` with a camera query that returns the given result. */
export const stubPermissionQuery = (result: PermissionQueryResult) => {
  const original = Object.getOwnPropertyDescriptor(navigator, "permissions");
  const query = vi.fn<(descriptor: PermissionDescriptor) => Promise<PermissionStatus>>();
  if (result === "error") {
    query.mockRejectedValue(new TypeError("unsupported permission name"));
  } else {
    query.mockResolvedValue(new FakePermissionStatus("camera", result));
  }
  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query } });
  return {
    query,
    restore: () => {
      if (original) Object.defineProperty(navigator, "permissions", original);
      else Reflect.deleteProperty(navigator, "permissions");
    },
  };
};

/** Replaces `navigator.mediaDevices` with stubs: `getUserMedia` resolves a fake stream or rejects, and no cameras list. */
export const stubGetUserMedia = (error?: Error) => {
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  const getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>();
  const enumerateDevices = vi.fn<() => Promise<MediaDeviceInfo[]>>().mockResolvedValue([]);
  if (error) getUserMedia.mockRejectedValue(error);
  else getUserMedia.mockResolvedValue(new FakeMediaStream());
  const events = new EventTarget();
  const value = Object.assign(events, { getUserMedia, enumerateDevices });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value });
  return {
    getUserMedia,
    enumerateDevices,
    /** Tells the page that the cameras changed. */
    changeDevices: () => events.dispatchEvent(new Event("devicechange")),
    restore: () => {
      if (original) Object.defineProperty(navigator, "mediaDevices", original);
      else Reflect.deleteProperty(navigator, "mediaDevices");
    },
  };
};
