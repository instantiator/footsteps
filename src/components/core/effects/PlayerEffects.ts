import type {
  GameEffect,
  GamePlayerChoice,
  GamePlayerFallEffect,
  GamePlayerOpacityEffect,
  GamePlayerRestoreEffect,
  GamePlayerSpinAwayEffect,
} from "../../../entities/data/displays/GameEffectData";
import type { DisplayScope } from "../../../entities/state/GameState";
import { centreOf } from "../../../vision/Tracking";
import type { PlayerRegistry } from "../../camera/PlayerRegistry";
import type { RuleEvent } from "../logic/GameRuleUtils";
import type { ScreenPoint } from "./EffectTargets";
import type { EffectRun, ItemEffects } from "./ItemEffects";

/** A size on screen. */
interface ScreenSize {
  /** Across. */
  width: number;
  /** Down. */
  height: number;
}

/** The wrapper of the player with this number; effects stay with it, as it stays with them. */
const wrapperOfNumber = (number: number | undefined): HTMLElement | null =>
  number === undefined ? null : document.querySelector<HTMLElement>(`.player-${number}`);

/** Whether a player's image is mirrored on screen, so their body is on the other side of their canvas. */
const isMirrored = (wrapper: HTMLElement): boolean =>
  wrapper.querySelector("canvas")?.style.transform.includes("scaleX(-1)") === true;

/** How far up the frame the top of a person's silhouette is, as a fraction of its height. */
export const silhouetteTop = (mask: Uint8Array, width: number, height: number): number => {
  const first = mask.indexOf(1);
  return first < 0 || height <= 0 ? 1 : Math.floor(first / width) / height;
};

/**
 * How far a player must travel in a direction to be fully off the display, centre first.
 * @param centre where their body's centre is, with the display's top left at 0, 0
 * @param radius the furthest any of them reaches from it, as they arrive, allowing for zoom and rotation
 * @param degrees 0 is straight up, 90 is right, and -90 is left
 */
export const offscreenDistance = (
  centre: ScreenPoint,
  radius: number,
  degrees: number,
  { width, height }: ScreenSize,
): number => {
  const radians = (degrees * Math.PI) / 180;
  const across = Math.sin(radians);
  const down = -Math.cos(radians);
  const toEdge = (from: number, size: number, direction: number) => {
    if (direction === 0) return Infinity;
    return ((direction > 0 ? size - from : from) + radius) / Math.abs(direction);
  };
  return Math.min(toEdge(centre.x, width, across), toEdge(centre.y, height, down));
};

/** Who a player effect applies to, of those it can apply to. */
const chosenIds = (
  choice: GamePlayerChoice | undefined,
  event: RuleEvent,
  players: PlayerRegistry,
  where: string,
): number[] => {
  if (choice === "all") return Array.from(players.knownIds());
  if (event.player === 0) {
    console.warn(`${where}: no player fired this rule, so there's nobody for it to apply to; try players: "all"`);
    return [];
  }
  const id = players.idOf(event.player);
  return id === undefined ? [] : [id];
};

/** What a player effect needs to know about the rule that started it. */
export interface PlayerEffectRun extends EffectRun {
  /** The display whose rule started it. */
  scope: DisplayScope;
  /** The event its rule fired with. */
  event: RuleEvent;
  /** Where the action is in the game's rules, for error messages. */
  where: string;
}

/**
 * Plays effects on players: on their wrappers, which stay with them, and in what the registry knows has happened to
 * them. Those that move a player use the same animations as effects on items.
 */
export class PlayerEffects {
  private readonly effects: ItemEffects;
  private readonly players: PlayerRegistry;

  constructor(effects: ItemEffects, players: PlayerRegistry) {
    this.effects = effects;
    this.players = players;
  }

  /** Starts an effect on the players it chooses. */
  play(effect: GameEffect, run: PlayerEffectRun): void {
    const choice = "players" in effect ? effect.players : undefined;
    for (const id of chosenIds(choice, run.event, this.players, run.where)) this.playOn(id, effect, run);
  }

  /**
   * Ends what has happened to a player, as their display has ended. If they are to stay removed, one on the way goes
   * straight to removed; one already there stays.
   */
  end(id: number, keepRemoved: boolean): void {
    const wrapper = wrapperOfNumber(this.players.numberOf(id));
    const state = this.players.stateOf(id);
    if (keepRemoved && state === "removed") return;
    if (keepRemoved && state === "leaving") {
      if (wrapper !== null) this.effects.finish(wrapper);
      this.players.finishLeaving(id);
      return;
    }
    this.restore(id, wrapper);
  }

  /** Where on screen the centre of a player's body is, given the wrapper around their canvas. */
  bodyCentre(wrapper: Element): ScreenPoint {
    const rect = wrapper.getBoundingClientRect();
    const fallback = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const number = wrapper instanceof HTMLElement ? Number(wrapper.dataset.player) : 0;
    const id = this.players.idOf(number);
    const person = id === undefined ? undefined : this.players.lastOf(id);
    const { width, height } = this.players.frameSize();
    const centre = person === undefined ? null : centreOf(person, width);
    if (centre === null || width === 0 || height === 0 || !(wrapper instanceof HTMLElement)) return fallback;
    const across = isMirrored(wrapper) ? 1 - centre.x / width : centre.x / width;
    return { x: rect.left + across * rect.width, y: rect.top + (centre.y / height) * rect.height };
  }

  /** Starts an effect on one player. */
  private playOn(id: number, effect: GameEffect, run: PlayerEffectRun): void {
    const wrapper = wrapperOfNumber(this.players.numberOf(id));
    if (effect.effect === "player-fall") this.leave(id, wrapper, run, (leaving) => this.fall(leaving, id, effect, run));
    else if (effect.effect === "player-spin-away") {
      this.leave(id, wrapper, run, (leaving) => this.spin(leaving, id, effect, run));
    } else if (effect.effect === "player-restore") this.restore(id, wrapper, effect, run);
    else if (effect.effect === "player-freeze" || effect.effect === "player-unfreeze") {
      this.setFrozen(id, effect.effect === "player-freeze", run);
      if (wrapper !== null) run.onEnd(wrapper);
    } else if (wrapper !== null) this.playOnWrapper(wrapper, effect, run);
  }

  /** Starts an effect that only changes how a player is drawn. */
  private playOnWrapper(wrapper: HTMLElement, effect: GameEffect, run: EffectRun): void {
    if (effect.effect === "player-invisible" || effect.effect === "player-visible") this.fade(wrapper, effect, run);
    else if (effect.effect === "stop") this.effects.stop([wrapper], effect.stop);
  }

  /** Freezes or unfreezes a player, unless they are leaving or have gone. */
  private setFrozen(id: number, frozen: boolean, { scope }: PlayerEffectRun): void {
    const state = this.players.stateOf(id);
    if (frozen && state === "active") this.players.freeze(id, scope);
    if (!frozen && state === "frozen") this.players.restore(id);
  }

  /** Starts a player leaving, if they aren't already, going as `go` says; they are removed as it ends. */
  private leave(
    id: number,
    wrapper: HTMLElement | null,
    run: PlayerEffectRun,
    go: (wrapper: HTMLElement) => void,
  ): void {
    const state = this.players.stateOf(id);
    if (state === "leaving" || state === "removed") return;
    this.players.startLeaving(id, run.scope);
    if (wrapper !== null) go(wrapper);
    else this.players.finishLeaving(id);
  }

  /** Drops a player off the display. */
  private fall(wrapper: HTMLElement, id: number, effect: GamePlayerFallEffect, run: EffectRun): void {
    const person = this.players.lastOf(id);
    const { width, height } = this.players.frameSize();
    const top = person === undefined ? 0 : silhouetteTop(person.mask, width, height);
    const distance = (1 - top) * 100;
    const keyframes = [{ translate: "0 0" }, { translate: `0 ${distance}%` }];
    this.effects.playToEnd({ element: wrapper, name: effect.effect }, keyframes, effect, this.leaving(id, run));
  }

  /** Knocks a player off the display, turning about the centre of their body. */
  private spin(wrapper: HTMLElement, id: number, effect: GamePlayerSpinAwayEffect, run: EffectRun): void {
    const { angle, zoom = 1, opacity = 1, rotations = 2, easing = "ease-out", durationMs = 1000 } = effect;
    const { min, max } = angle ?? { min: -60, max: 60 };
    const degrees = min + Math.random() * (max - min);
    const turn = rotations * 360 * (Math.random() < 0.5 ? -1 : 1);
    const rect = wrapper.getBoundingClientRect();
    const centre = this.bodyCentre(wrapper);
    const fromCorner = { x: centre.x - rect.left, y: centre.y - rect.top };
    wrapper.style.transformOrigin = `${fromCorner.x}px ${fromCorner.y}px`;
    const person = this.players.lastOf(id);
    const size = this.players.frameSize();
    const radius = this.reachOf(person?.mask, size, rect) * zoom;
    const distance = offscreenDistance(fromCorner, radius, degrees, rect);
    const radians = (degrees * Math.PI) / 180;
    const keyframes = [
      { translate: "0 0", rotate: "0deg", scale: "1", opacity: 1 },
      {
        translate: `${Math.sin(radians) * distance}px ${-Math.cos(radians) * distance}px`,
        rotate: `${turn}deg`,
        scale: String(zoom),
        opacity,
      },
    ];
    const on = { element: wrapper, name: effect.effect };
    this.effects.playToEnd(on, keyframes, { durationMs, easing, composite: "replace" }, this.leaving(id, run));
  }

  /** The furthest a person's silhouette reaches from its middle, on screen. */
  private reachOf(mask: Uint8Array | undefined, { width, height }: ScreenSize, rect: ScreenSize): number {
    if (mask === undefined || width === 0 || height === 0) return Math.hypot(rect.width, rect.height);
    let [left, right, top, bottom] = [width, 0, height, 0];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] !== 1) continue;
      const x = i % width;
      const y = (i - x) / width;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    const across = ((right - left) / width) * rect.width;
    const down = ((bottom - top) / height) * rect.height;
    return Math.hypot(across, down);
  }

  /** The same run, removing the player as the effect ends, before rules hear of it. */
  private leaving(id: number, run: EffectRun): EffectRun {
    return {
      ...run,
      onEnd: (element) => {
        this.players.finishLeaving(id);
        run.onEnd(element);
      },
    };
  }

  /** Fades a player out or in, where they stay. */
  private fade(
    wrapper: HTMLElement,
    { effect, durationMs = 0, easing = "linear" }: GamePlayerOpacityEffect,
    run: EffectRun,
  ): void {
    const from = getComputedStyle(wrapper).opacity;
    const keyframes = [{ opacity: from }, { opacity: effect === "player-invisible" ? 0 : 1 }];
    const timing = { durationMs, easing, composite: "replace" as const };
    this.effects.playToEnd({ element: wrapper, name: "player-opacity" }, keyframes, timing, run);
  }

  /** Returns a player to normal, fading them back in if anything had happened to them. */
  private restore(id: number, wrapper: HTMLElement | null, effect?: GamePlayerRestoreEffect, run?: EffectRun): void {
    const wasAffected = this.players.stateOf(id) !== "active" || (wrapper !== null && this.effects.isRunning(wrapper));
    this.players.restore(id);
    if (wrapper === null) return;
    this.effects.stop([wrapper], undefined);
    wrapper.style.removeProperty("transform-origin");
    if (effect === undefined || run === undefined) return;
    const durationMs = effect.durationMs ?? 500;
    if (!wasAffected || durationMs === "indefinite") {
      run.onEnd(wrapper);
      return;
    }
    const keyframes = [{ opacity: 0 }, { opacity: 1 }];
    this.effects.playOnce({ element: wrapper, name: effect.effect }, keyframes, { duration: durationMs }, run);
  }
}
