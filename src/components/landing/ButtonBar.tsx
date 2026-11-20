import type { ReactNode } from "react";

/** The bar of buttons along the bottom of a game's pages: one group at the start, and one at the end. */
export default function ButtonBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="game-button-bar">
      {start}
      <span className="game-button-bar-gap" />
      {end}
    </div>
  );
}
