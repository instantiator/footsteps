import { isDefined } from "../../util/ObjectUtils";
import type { VisionFrame } from "../../vision/VisionTypes";
import { drawPeople, drawStatic, type DrawStyle } from "./DrawPeople";
import type { PlayerCanvas, PlayerCanvases } from "./PlayerCanvases";
import { depthZIndex, drawDepthLine, type PlayerPosition } from "./PlayerPosition";
import type { PlayerFrames, PlayerRegistry } from "./PlayerRegistry";
import type { StaticLook } from "./PlayerStatic";
import type { SpectatorReport } from "./Spectators";
import type { GameSpectatorLook, GameSpectatorsData } from "../../entities/data/scenes/GameSpectatorsData";
import { placementStyle, type Placement } from "./VirtualPlayers";

/** How spectators are drawn this frame. */
export interface DrawnSpectators {
  /** Who is a spectator, and how far off the floor each player stands. */
  report: SpectatorReport;
  /** How the scenes shown want them to look. */
  settings: GameSpectatorsData;
  /** How far off the floor someone must be to be a spectator, where a fade starts by default, in floor units. */
  margin: number;
}

/** The size of a spectator's static blocks, as `player-static`'s default. */
const SPECTATOR_STATIC_PIXEL_SIZE = 0.5;

/** How strong a spectator's look is, 0–1, at a distance off the floor: eased from the fade's start to its end. */
export const spectatorStrength = (distance: number, fade: GameSpectatorsData["fade"], margin: number): number => {
  if (fade === undefined) return 1;
  const { from = margin, to } = fade;
  const t = to <= from ? Number(distance >= to) : Math.min(Math.max((distance - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Gives a shown spectator's wrapper their look, or takes it off a player who was one. */
const lookAs = (wrapper: HTMLElement, look: GameSpectatorLook | undefined, strength: number | undefined): void => {
  if (strength === undefined) {
    if (wrapper.dataset.spectator === undefined) return;
    delete wrapper.dataset.spectator;
    wrapper.style.removeProperty("opacity");
    wrapper.style.removeProperty("filter");
    wrapper.style.removeProperty("--spectator-strength");
    return;
  }
  wrapper.dataset.spectator = "";
  wrapper.style.setProperty("--spectator-strength", String(strength));
  if (look?.opacity !== undefined) wrapper.style.opacity = String(1 - (1 - look.opacity) * strength);
  if (look?.filter !== undefined) wrapper.style.filter = look.filter;
};

/** A player's static from an effect, as it is now, if one runs. */
const staticNow = (players: PlayerRegistry, id: number | undefined): StaticLook | undefined =>
  id === undefined ? undefined : players.staticOf(id)?.lookAt(performance.now());

/**
 * Hides a spectator or gives them their look, unless debugging, which draws everyone alike.
 * @returns whether they are hidden, and their look's static, if any
 */
const showSpectator = (
  wrapper: HTMLElement,
  id: number | undefined,
  { report, settings, margin }: DrawnSpectators,
  debugging: boolean,
): { hidden: boolean; look?: StaticLook } => {
  const spectating = !debugging && id !== undefined && report.spectators.has(id);
  wrapper.hidden = spectating && settings.show !== "shown";
  const strength = spectating ? spectatorStrength(report.distances.get(id) ?? 0, settings.fade, margin) : undefined;
  if (!wrapper.hidden) lookAs(wrapper, settings.look, strength);
  return { hidden: wrapper.hidden, look: spectatorStatic(settings.look, strength) };
};

/** A spectator's static at a strength, if their look has any. */
const spectatorStatic = (look: GameSpectatorLook | undefined, strength: number | undefined): StaticLook | undefined =>
  look?.static === undefined || strength === undefined
    ? undefined
    : {
        pixelSize: SPECTATOR_STATIC_PIXEL_SIZE,
        proportion: look.static * strength,
        still: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      };

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
  /** Where each player's cut-out is moved to, by id, when they are drawn other than life-size (a spike). */
  placements?: Map<number, Placement>;
  /** Whether players sort among the foreground, as they do on a floor. */
  sorted: boolean;
}

/**
 * Sorts a player to their floor depth on a floor, and moves their cut-out to its placement, if it has one. Unsorted,
 * they keep the reference's z-index, as their wrapper was made with.
 */
const arrangePlayer = (
  { wrapper, canvas }: PlayerCanvas,
  where: PlayerPosition | undefined,
  placement: Placement | undefined,
  sorted: boolean,
) => {
  if (sorted && where) wrapper.style.zIndex = String(depthZIndex(where.position.y));
  Object.assign(canvas.style, placementStyle(placement));
};

/**
 * Draws each player on their own canvas. On a floor, each is sorted to their depth. Spectators are hidden, or drawn
 * with their look, except when debugging, which draws everyone alike. When debugging, a line shows the height of the
 * ground point a player's position comes from.
 */
export const drawPlayers = (
  video: HTMLVideoElement,
  { drawn: frame, frozenIds, knownIds }: PlayerFrames,
  {
    canvases,
    positions,
    placements,
    sorted,
    players,
    spectators,
  }: DrawnPositions & { canvases: PlayerCanvases; players: PlayerRegistry; spectators: DrawnSpectators },
  style: DrawStyle,
) => {
  const debugging = style.maskType !== "binary";
  const drawOne = (player: PlayerCanvas, playerFrame: VisionFrame) => {
    const { wrapper, canvas } = player;
    const id = playerFrame.people[0]?.id;
    const { hidden, look: spectatorLook } = showSpectator(wrapper, id, spectators, debugging);
    if (hidden) return;
    const where = positions.get(id);
    arrangePlayer(player, where, placements?.get(id), sorted);
    if (id !== undefined) namePlayer(wrapper, players.numberOf(id));
    // The 2D context is missing in some environments (eg. tests); the reports above still happen
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const look = staticNow(players, id) ?? spectatorLook;
    const frozen = frozenIds.has(id);
    drawPlayerImage(player, ctx, { look, frozen, draw: (onto) => drawPeople(video, playerFrame, onto, style) });
    if (!frozen && debugging && where) drawDepthLine(ctx, where.ground.y);
  };
  canvases.draw(frame, drawOne, knownIds);
};
