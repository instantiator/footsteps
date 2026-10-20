import { Children } from "react";

/**
 * Lays a layer's challenges side by side in equal-width columns. Clicks pass through the grid
 * and its columns to the elements inside them.
 */
export default function GameChallengeGrid({
  className,
  style,
  layer,
  layerHint,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Name of the layer (overview, stage or challenges) the grid belongs to; used to build element ids. */
  layer: string;
  /** Whether the grid is in the layer's background or foreground; used to build element ids. */
  layerHint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`${layer}-${layerHint}-grid`}
      key={`${layer}-${layerHint}-grid`}
      className={[className, "noClicks"].filter(Boolean).join(" ")}
      style={{
        ...style,
        display: "flex",
        flexDirection: "row",
        justifyContent: "stretch",
        alignItems: "stretch",
      }}
    >
      {Children.map(children, (child, index) => (
        <div
          id={`${layer}-${layerHint}-grid-child-${index}`}
          key={`${layer}-${layerHint}-grid-child-${index}`}
          style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, overflow: "hidden" }}
          className="childClicksOnly"
        >
          {child}
        </div>
      ))}
    </div>
  );
}
