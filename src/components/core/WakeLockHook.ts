import { useEffect, useRef } from "react";
import { isDefined } from "../../util/ObjectUtils";

/**
 * Keeps the screen awake while `active` is true, when the page is visible and the browser supports
 * the Screen Wake Lock API. The lock is released when the page is hidden or the hook is unmounted.
 */
export const useWakeLock = (active: boolean): void => {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let requesting = false;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (isDefined(sentinel)) void sentinel.release().catch(() => {});
    };

    const request = async () => {
      if (cancelled || requesting || document.visibilityState !== "visible") return;
      const wakeLock = navigator.wakeLock;
      if (!isDefined(wakeLock)) return;

      requesting = true;
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled || document.visibilityState !== "visible") {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch (error) {
        console.warn("Could not keep the screen awake:", error);
      } finally {
        requesting = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!isDefined(sentinelRef.current)) void request();
      } else {
        release();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
};
