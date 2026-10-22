import type { Page } from "@playwright/test";

declare global {
  interface Window {
    /** How many times the silhouette loop has cleared the character canvas, ie. drawn a frame without a player. */
    __cameraDraws: number;
  }
}

/**
 * Counts completed silhouette frames before the page's own scripts run.
 *
 * The loop clears the character canvas when it finds nobody, and draws the player's mask when it
 * finds somebody. Counting both is a reliable sign that segmentation is running, unlike page-wide
 * animation frames, which run for other reasons too.
 */
export const installCameraDrawCounter = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.__cameraDraws = 0;
    const isCharacterCanvas = (context: CanvasRenderingContext2D) =>
      context.canvas.parentElement?.id === "character-canvas-container";

    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = new Proxy(clearRect, {
      apply(target, thisArg, args) {
        if (thisArg instanceof CanvasRenderingContext2D && isCharacterCanvas(thisArg)) window.__cameraDraws++;
        return Reflect.apply(target, thisArg, args);
      },
    });

    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = new Proxy(drawImage, {
      apply(target, thisArg, args) {
        if (thisArg instanceof CanvasRenderingContext2D && isCharacterCanvas(thisArg)) window.__cameraDraws++;
        return Reflect.apply(target, thisArg, args);
      },
    });
  });
};
