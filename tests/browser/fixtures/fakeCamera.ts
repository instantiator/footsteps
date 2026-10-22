import type { Page } from "@playwright/test";

/** The scenes the fake webcam can show. */
export type FakeCameraImage = "room" | "person";

/** What the fake webcam exposes to the page, and so to tests. */
export interface FakeCameraState {
  /** Replaces the scene the camera shows; the next captured frames differ. */
  setImage: (image: FakeCameraImage) => void;
  /** Every stream the page has been given, oldest first. */
  streams: MediaStream[];
}

declare global {
  interface Window {
    __fakeCamera: FakeCameraState;
  }
}

/**
 * Installs a fake webcam before the page's own scripts run.
 *
 * `getUserMedia` returns a stream captured from a canvas, so the real camera pipeline runs
 * without a physical camera. `window.__fakeCamera` switches the scene and exposes the streams.
 */
export const installFakeCamera = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const width = 640;
    const height = 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("the fake camera needs a 2D canvas");

    /** Paints a plain room, optionally with a simple person standing in it. */
    const paint = (image: FakeCameraImage) => {
      context.fillStyle = "#d9d4c7";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#b9b09a";
      context.fillRect(0, height * 0.7, width, height * 0.3);
      context.fillStyle = "#8fa3ad";
      context.fillRect(width * 0.08, height * 0.12, width * 0.2, height * 0.24);

      if (image !== "person") return;
      context.fillStyle = "#2f4858";
      context.beginPath();
      context.arc(width / 2, height * 0.2, width * 0.08, 0, Math.PI * 2);
      context.fill();
      context.fillRect(width * 0.43, height * 0.28, width * 0.14, height * 0.32);
      context.fillRect(width * 0.3, height * 0.32, width * 0.11, height * 0.22);
      context.fillRect(width * 0.59, height * 0.32, width * 0.11, height * 0.22);
      context.fillRect(width * 0.44, height * 0.6, width * 0.05, height * 0.35);
      context.fillRect(width * 0.51, height * 0.6, width * 0.05, height * 0.35);
    };

    const streams: MediaStream[] = [];
    let image: FakeCameraImage = "room";
    const state: FakeCameraState = { streams, setImage: () => undefined };
    state.setImage = (next) => {
      image = next;
      paint(image);
    };
    window.__fakeCamera = state;
    paint(image);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const stream = canvas.captureStream(10);
          // A canvas only sends frames for changes made after its capture stream starts
          paint(image);
          streams.push(stream);
          return stream;
        },
      },
    });
  });
};
