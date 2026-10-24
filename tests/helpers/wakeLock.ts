import { vi } from "vitest";

/** A screen wake lock sentinel stand-in for jsdom, which has no Screen Wake Lock API. */
export class FakeWakeLockSentinel extends EventTarget implements WakeLockSentinel {
  readonly type = "screen";
  released = false;
  onrelease = null;

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event("release"));
  }
}

/** Replaces `navigator.wakeLock` with a request stub, returning the stub and a way to restore the original. */
export const stubWakeLock = (impl: () => Promise<WakeLockSentinel> = async () => new FakeWakeLockSentinel()) => {
  const original = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
  const request = vi.fn<(type?: WakeLockType) => Promise<WakeLockSentinel>>();
  request.mockImplementation(() => impl());
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
  return {
    request,
    restore: () => {
      if (original) Object.defineProperty(navigator, "wakeLock", original);
      else Reflect.deleteProperty(navigator, "wakeLock");
    },
  };
};

/** Replaces `navigator.wakeLock` with an unsupported browser's missing API. */
export const stubNoWakeLock = () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
  return () => {
    if (original) Object.defineProperty(navigator, "wakeLock", original);
    else Reflect.deleteProperty(navigator, "wakeLock");
  };
};

/** Makes `document.visibilityState` settable, returning a setter and a way to restore the original. */
export const stubVisibility = () => {
  const original = Object.getOwnPropertyDescriptor(document, "visibilityState");
  return {
    set: (state: DocumentVisibilityState) =>
      Object.defineProperty(document, "visibilityState", { configurable: true, value: state }),
    restore: () => {
      if (original) Object.defineProperty(document, "visibilityState", original);
      else Reflect.deleteProperty(document, "visibilityState");
    },
  };
};
