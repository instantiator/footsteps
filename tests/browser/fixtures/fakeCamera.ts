import type { Page } from "@playwright/test";

/** The scenes the fake webcam can show: drawn ones, or a photo the camera was installed with. */
export type FakeCameraImage = "room" | "person" | `photo:${string}`;

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
 * @param photos image URLs by name, shown by `setImage("photo:<name>")`, letterboxed to the camera's shape
 */
export const installFakeCamera = async (page: Page, photos: Record<string, string> = {}): Promise<void> => {
  await page.addInitScript((photoUrls: Record<string, string>) => {
    const width = 640;
    const height = 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("the fake camera needs a 2D canvas");

    const photos = new Map(Object.entries(photoUrls).map(([name, src]) => [name, Object.assign(new Image(), { src })]));

    /** Paints a photo, scaled to fit, on black; it paints once the photo has loaded. */
    const paintPhoto = (photo: HTMLImageElement | undefined) => {
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      if (!photo?.complete || photo.naturalWidth === 0) return;
      const scale = Math.min(width / photo.naturalWidth, height / photo.naturalHeight);
      const [w, h] = [photo.naturalWidth * scale, photo.naturalHeight * scale];
      context.drawImage(photo, (width - w) / 2, (height - h) / 2, w, h);
    };

    /** Paints a photo, or a plain room, optionally with a simple person standing in it. */
    const paint = (image: FakeCameraImage) => {
      if (image.startsWith("photo:")) return paintPhoto(photos.get(image.slice("photo:".length)));
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
    // A canvas only sends frames when it is painted, so repaint at a webcam's rate to keep frames coming
    setInterval(() => paint(image), 1000 / 30);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const stream = canvas.captureStream(30);
          streams.push(stream);
          return stream;
        },
      },
    });
  }, photos);
};
