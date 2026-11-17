/** A point on the screen, in client pixels. */
export interface ClientPoint {
  /** Pixels from the viewport's left edge. */
  x: number;
  /** Pixels from the viewport's top edge. */
  y: number;
}

/** Where the pointer last was over the page, or undefined if it isn't over it (or hasn't moved yet). */
let last: ClientPoint | undefined;
let tracking = false;

/** Starts following the pointer over the page, once, so a scene can find what is under a pointer that hasn't moved. */
export const trackPointer = (): void => {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  window.addEventListener("pointermove", (event) => (last = { x: event.clientX, y: event.clientY }), { passive: true });
  window.addEventListener("pointerout", (event) => {
    if (event.relatedTarget === null) last = undefined;
  });
};

/** Where the pointer last was over the page, if it is still over it. */
export const lastPointer = (): ClientPoint | undefined => last;
