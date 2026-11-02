import type { VisionFrame } from "../../vision/VisionTypes";

/**
 * Gives each player in a frame their own canvas, so each can be layered separately. The first player uses the canvas
 * given; others get a copy of it, made and removed as the number of players changes.
 *
 * Canvases are redrawn every frame, so they go by position in the frame, not by player.
 */
export class PlayerCanvases {
  private readonly first: HTMLCanvasElement;
  private readonly extras: HTMLCanvasElement[] = [];

  /** @param first the canvas for the first player, already at its final size */
  constructor(first: HTMLCanvasElement) {
    this.first = first;
  }

  /**
   * Draws each person on their own canvas, or clears the first if nobody is there.
   * @param draw draws the frame given, which holds one person or nobody, on the canvas given
   * @returns each person's canvas, in the frame's order
   */
  draw(frame: VisionFrame, draw: (canvas: HTMLCanvasElement, playerFrame: VisionFrame) => void): HTMLCanvasElement[] {
    this.fit(frame.people.length);
    const canvases = [this.first, ...this.extras];
    const frames = frame.people.length > 0 ? frame.people.map((person) => ({ ...frame, people: [person] })) : [frame];
    frames.forEach((playerFrame, index) => draw(canvases[index], playerFrame));
    return canvases.slice(0, frame.people.length);
  }

  /** Removes every canvas but the first. */
  removeExtras(): void {
    this.fit(1);
  }

  /** Adds or removes canvases to suit the number of players. */
  private fit(players: number): void {
    while (this.extras.length < players - 1) this.extras.push(this.copyOfFirst());
    while (this.extras.length > Math.max(players - 1, 0)) this.extras.pop()?.remove();
  }

  /** A new canvas beside the first, that looks the same. */
  private copyOfFirst(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.first.width;
    canvas.height = this.first.height;
    canvas.className = this.first.className;
    canvas.style.cssText = this.first.style.cssText;
    this.first.after(canvas);
    return canvas;
  }
}
