import { useCallback, useEffect, useState } from "react";
import { isDefined } from "../../util/ObjectUtils";

/** The document's fullscreen state, and a way to toggle it. */
interface Fullscreen {
  /** True while the document is in fullscreen. */
  isFullscreen: boolean;
  /** Enters fullscreen, or leaves it when already there. */
  toggle: () => void;
}

/**
 * Whether the document is in fullscreen, and a way to toggle it.
 *
 * NB. Browsers only allow fullscreen from a user gesture, so `toggle` belongs on a button.
 */
export default function useFullscreen(): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Follow every change, including ones the browser makes without the button (Esc, or leaving the tab)
  useEffect(() => {
    const update = () => setIsFullscreen(isDefined(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  // Ask the browser to enter or leave fullscreen, warning rather than failing when it refuses
  const toggle = useCallback(() => {
    if (!document.fullscreenEnabled) {
      console.warn("Full screen is not available in this browser.");
      return;
    }
    const request = isDefined(document.fullscreenElement)
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void request.catch((error: unknown) => console.warn("Could not toggle full screen:", error));
  }, []);

  return { isFullscreen, toggle };
}
