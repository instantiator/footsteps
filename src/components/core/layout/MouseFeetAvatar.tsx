import { useEffect, useRef, type RefObject } from "react";
import { isDefined } from "../../../util/ObjectUtils";
import { useGameData } from "../../../providers/GameDataHook";
import type { FloorView } from "../../camera/FloorGeometry";
import { depthZIndex, UNSORTED_PLAYER_Z_INDEX } from "../../camera/PlayerPosition";
import type { ResolvedFeet } from "../logic/AvatarModeUtils";
import { footprintAt, type FeetAt } from "./MouseFeetHook";

/** Draws the feet where the pointer is, or hides them as it leaves. */
export type DrawFeet = (at: FeetAt | null) => void;

/** Props for {@link MouseFeetAvatar}. */
interface MouseFeetAvatarProps {
  /** How the feet look. */
  look: ResolvedFeet;
  /** The floor a 2.5D scene is fitted to; undefined in a 2D scene. */
  floor: FloorView | undefined;
  /** Given the avatar's draw function while it is mounted, for the pointer's moves to call. */
  drawRef: RefObject<DrawFeet | null>;
}

/** Moves the avatar to the pointer, sized and sorted for where it stands, or hides it. */
const draw = (avatar: HTMLElement | null, at: FeetAt | null, floor: FloorView | undefined, size: number) => {
  const box = avatar?.parentElement?.getBoundingClientRect();
  if (!avatar || !box) return;
  avatar.hidden = at === null;
  if (at === null) return;
  const { centre, rx, ry, depth } = footprintAt(at.point, box, floor, size);
  avatar.style.left = `${(centre.x - box.left).toFixed(1)}px`;
  avatar.style.top = `${(centre.y - box.top).toFixed(1)}px`;
  avatar.style.setProperty("--feet-width", `${(2 * rx).toFixed(1)}px`);
  avatar.style.setProperty("--feet-height", `${(2 * ry).toFixed(1)}px`);
  avatar.style.zIndex = String(isDefined(depth) ? depthZIndex(depth) : UNSORTED_PLAYER_Z_INDEX);
  avatar.toggleAttribute("data-airborne", at.airborne);
};

/**
 * What the pointer's feet look like in `mouse-feet` mode: a footprint on the floor (or an image standing on it), lifted
 * over a shadow mid-jump. It is moved directly, not re-rendered, as the pointer moves.
 */
export default function MouseFeetAvatar({ look, floor, drawRef }: MouseFeetAvatarProps) {
  const { resources } = useGameData();
  const avatarRef = useRef<HTMLDivElement>(null);
  const { size, color, imageResource, cursor } = look;
  useEffect(() => {
    drawRef.current = (at) => draw(avatarRef.current, at, floor, size);
    return () => {
      drawRef.current = null;
    };
  }, [drawRef, floor, size]);

  return (
    <div ref={avatarRef} className="mouse-feet-avatar" data-cursor={cursor} hidden>
      <div className="mouse-feet-shadow" />
      {isDefined(imageResource) ? (
        <img className="mouse-feet-body" src={resources[imageResource]} alt="" draggable={false} />
      ) : (
        <div className="mouse-feet-body" style={{ background: color }} />
      )}
    </div>
  );
}
