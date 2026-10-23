import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "../src/components/core/WakeLockHook";
import { FakeWakeLockSentinel, stubNoWakeLock, stubVisibility, stubWakeLock } from "./helpers/wakeLock";

const restores: (() => void)[] = [];

const wakeLock = (impl?: () => Promise<WakeLockSentinel>) => {
  const stub = stubWakeLock(impl);
  restores.push(stub.restore);
  return stub;
};

const visibility = () => {
  const stub = stubVisibility();
  restores.push(stub.restore);
  return stub;
};

afterEach(() => {
  restores.forEach((restore) => restore());
  restores.length = 0;
  vi.restoreAllMocks();
});

const renderWakeLock = (initialActive = true) =>
  renderHook(({ active }: { active: boolean }) => useWakeLock(active), { initialProps: { active: initialActive } });

describe("useWakeLock", () => {
  it("requests a screen wake lock when active and visible", async () => {
    const { request } = wakeLock();
    renderWakeLock();

    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("does not request a wake lock when inactive", async () => {
    const { request } = wakeLock();
    renderWakeLock(false);

    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });

  it("releases the wake lock when it becomes inactive", async () => {
    const sentinel = new FakeWakeLockSentinel();
    const { request } = wakeLock(async () => sentinel);
    const { rerender } = renderWakeLock();
    await waitFor(() => expect(request).toHaveBeenCalled());

    rerender({ active: false });

    await waitFor(() => expect(sentinel.released).toBe(true));
  });

  it("releases the wake lock when unmounted", async () => {
    const sentinel = new FakeWakeLockSentinel();
    const { request } = wakeLock(async () => sentinel);
    const { unmount } = renderWakeLock();
    await waitFor(() => expect(request).toHaveBeenCalled());

    unmount();

    await waitFor(() => expect(sentinel.released).toBe(true));
  });

  it("releases when the page is hidden and reacquires when it is visible again", async () => {
    const visibilityStub = visibility();
    const first = new FakeWakeLockSentinel();
    const second = new FakeWakeLockSentinel();
    const queue = [first, second];
    const { request } = wakeLock(async () => queue.shift() ?? new FakeWakeLockSentinel());
    renderWakeLock();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    act(() => {
      visibilityStub.set("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(first.released).toBe(true));

    act(() => {
      visibilityStub.set("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(second.released).toBe(false);
  });

  it("does not request a wake lock while the page is hidden", async () => {
    const visibilityStub = visibility();
    visibilityStub.set("hidden");
    const { request } = wakeLock();
    renderWakeLock();

    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing when the browser has no Screen Wake Lock API", async () => {
    const restore = stubNoWakeLock();
    restores.push(restore);

    renderWakeLock();

    await Promise.resolve();
  });

  it("warns rather than failing when the browser refuses the wake lock", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    wakeLock(async () => {
      throw new Error("NotAllowedError");
    });
    renderWakeLock();

    await waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
