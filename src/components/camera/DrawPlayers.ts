import { isDefined } from "../../util/ObjectUtils";
import type { VisionFrame } from "../../vision/VisionTypes";
import { drawPeople, drawStatic, type DrawStyle } from "./DrawPeople";
import type { PlayerCanvas, PlayerCanvases } from "./PlayerCanvases";
import { depthZIndex, drawDepthLine, type PlayerDepths } from "./PlayerDepth";
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

/** Draws each player on their own canvas, sorted to their depth, with a line showing it when debugging. */
export const drawPlayers = (
  video: HTMLVideoElement,
  { drawn: frame, frozenIds, knownIds }: PlayerFrames,
  { canvases, depths, players }: { canvases: PlayerCanvases; depths: PlayerDepths; players: PlayerRegistry },
  style: DrawStyle,
) => {
  const debugging = style.maskType !== "binary";
  const playerDepths = depths.update(frame, debugging);
  const drawOne = (player: PlayerCanvas, playerFrame: VisionFrame) => {
    const { wrapper, canvas } = player;
    const id = playerFrame.people[0]?.id;
    const playerDepth = playerDepths.get(id);
    if (playerDepth !== undefined) wrapper.style.zIndex = String(depthZIndex(playerDepth));
    if (id !== undefined) namePlayer(wrapper, players.numberOf(id));
    // The 2D context is missing in some environments (eg. tests); the reports above still happen
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const look = id === undefined ? undefined : players.staticOf(id)?.lookAt(performance.now());
    const frozen = frozenIds.has(id);
    drawPlayerImage(player, ctx, { look, frozen, draw: (onto) => drawPeople(video, playerFrame, onto, style) });
    if (!frozen && debugging && playerDepth !== undefined) drawDepthLine(ctx, playerDepth);
  };
  canvases.draw(frame, drawOne, knownIds);
};
