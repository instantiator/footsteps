import type { VisionFrame } from "../../vision/VisionTypes";

/** What draws one player: a wrapper for effects and depth, around a canvas for their image. */
export interface PlayerCanvas {
  /** Sized like the reference, and holds the player's depth, effects and classes, so they don't touch mirroring. */
  wrapper: HTMLElement;
  /** Draws the player's image, and mirrors it if the reference does. */
  canvas: HTMLCanvasElement;
}

/**
 * Gives each player in a frame their own canvas, so each can be layered and moved separately, for as long as the player
 * is there.
 *
 * The canvas given is only a reference: it isn't shown, and it never moves, so it stays the thing to measure against
 * when a player's canvas is falling off the screen. Players' canvases look as it does, but take nothing from each
 * other, so a new player doesn't inherit another's effects.
 */
export class PlayerCanvases {
  private readonly reference: HTMLCanvasElement;
  private readonly players = new Map<number, PlayerCanvas>();

  /** @param reference what players' canvases are made to look like, already at its final size */
  constructor(reference: HTMLCanvasElement) {
    this.reference = reference;
  }

  /**
   * Draws each person on their own canvas, or clears the reference if nobody is there, so a frame always draws something.
   * @param draw draws the frame given, which holds one person or nobody, on the player's canvas
   */
  draw(frame: VisionFrame, draw: (player: PlayerCanvas, playerFrame: VisionFrame) => void): void {
    const seen = new Set(frame.people.map(({ id }) => id));
    for (const id of this.players.keys()) if (!seen.has(id)) this.remove(id);
    if (frame.people.length === 0) draw({ wrapper: this.reference, canvas: this.reference }, frame);
    for (const person of frame.people) draw(this.playerCanvas(person.id), { ...frame, people: [person] });
  }

  /** Matches every player's canvas to the reference's size, which clears it. */
  resize(): void {
    for (const { canvas } of this.players.values()) {
      canvas.width = this.reference.width;
      canvas.height = this.reference.height;
    }
  }

  /** Removes every player's canvas. */
  removeAll(): void {
    for (const id of Array.from(this.players.keys())) this.remove(id);
  }

  /** Removes a player's canvas. */
  private remove(id: number): void {
    this.players.get(id)?.wrapper.remove();
    this.players.delete(id);
  }

  /** A player's canvas, made as they first appear. */
  private playerCanvas(id: number): PlayerCanvas {
    const existing = this.players.get(id);
    if (existing !== undefined) return existing;
    const made = this.newPlayerCanvas();
    this.players.set(id, made);
    return made;
  }

  /** A new canvas beside the reference that looks the same, in a wrapper of the same size. */
  private newPlayerCanvas(): PlayerCanvas {
    const { reference } = this;
    const wrapper = document.createElement("div");
    wrapper.className = `playerWrapper player ${reference.className}`;
    wrapper.style.cssText = reference.style.cssText;
    wrapper.style.removeProperty("transform");
    const canvas = document.createElement("canvas");
    canvas.width = reference.width;
    canvas.height = reference.height;
    canvas.style.transform = reference.style.transform;
    wrapper.append(canvas);
    reference.after(wrapper);
    return { wrapper, canvas };
  }
}
