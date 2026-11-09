import { isDefined } from "../../util/ObjectUtils";
import type { VisionFrame } from "../../vision/VisionTypes";
import { drawPeople, drawStatic, type DrawStyle } from "./DrawPeople";
import type { PlayerCanvas, PlayerCanvases } from "./PlayerCanvases";
import { depthZIndex, drawDepthLine, type PlayerPosition } from "./PlayerPosition";
import type { PlayerFrames, PlayerRegistry } from "./PlayerRegistry";
import type { StaticLook } from "./PlayerStatic";

/** Gives a player's wrapper the classes that name them, which effects can target. */
const namePlayer = (wrapper: HTMLElement, number: number | undefined): void => {
  if (number === undefined || wrapper.dataset.player === String(number)) return;
  wrapper.classList.remove(`player-${wrapper.dataset.player}`);
  wrapper.classList.add(`player-${number}`);
  wrapper.dataset.player = String(number);
};

/** A new canvas the same size as one given, showing the same image. */
const copyOf = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  return copy;
};

/**
 * Draws a player's image, unless it is frozen. With static, a clean image is kept as well, as static only erases: so a
 * frozen player can have it put over their frozen image, and have it taken off again.
 */
const drawPlayerImage = (
  player: PlayerCanvas,
  ctx: CanvasRenderingContext2D,
  {
    look,
    frozen,
    draw,
  }: { look: StaticLook | undefined; frozen: boolean; draw: (onto: CanvasRenderingContext2D) => void },
): void => {
  const { canvas } = ctx;
  if (look === undefined) {
    if (!frozen) draw(ctx);
    else if (isDefined(player.clean)) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(player.clean, 0, 0);
    }
    player.clean = undefined;
    return;
  }
  player.clean ??= copyOf(canvas);
  const cleanCtx = player.clean.getContext("2d");
  if (!frozen && cleanCtx) draw(cleanCtx);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(player.clean, 0, 0);
  drawStatic(ctx, look);
};

/** Where the players are, and whether they sort among the foreground by their floor depth. */
interface DrawnPositions {
  /** Each player's position, by id. */
  positions: Map<number, PlayerPosition>;
  /** Whether players sort among the foreground, as they do on a floor. */
  sorted: boolean;
}

/** Sorts a player to their floor depth. Unsorted, they keep the reference's z-index, as their wrapper was made with. */
const sortPlayer = (wrapper: HTMLElement, where: PlayerPosition | undefined) => {
  if (where) wrapper.style.zIndex = String(depthZIndex(where.position.y));
};

/**
 * Draws each player on their own canvas. On a floor, each is sorted to their depth. When debugging, a line shows the
 * height of the ground point their position comes from.
 */
export const drawPlayers = (
  video: HTMLVideoElement,
  { drawn: frame, frozenIds, knownIds }: PlayerFrames,
  { canvases, positions, sorted, players }: DrawnPositions & { canvases: PlayerCanvases; players: PlayerRegistry },
  style: DrawStyle,
) => {
  const debugging = style.maskType !== "binary";
  const drawOne = (player: PlayerCanvas, playerFrame: VisionFrame) => {
    const { wrapper, canvas } = player;
    const id = playerFrame.people[0]?.id;
    const where = positions.get(id);
    if (sorted) sortPlayer(wrapper, where);
    if (id !== undefined) namePlayer(wrapper, players.numberOf(id));
    // The 2D context is missing in some environments (eg. tests); the reports above still happen
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const look = id === undefined ? undefined : players.staticOf(id)?.lookAt(performance.now());
    const frozen = frozenIds.has(id);
    drawPlayerImage(player, ctx, { look, frozen, draw: (onto) => drawPeople(video, playerFrame, onto, style) });
    if (!frozen && debugging && where) drawDepthLine(ctx, where.ground.y);
  };
  canvases.draw(frame, drawOne, knownIds);
};
