import { Children } from "react";

export default function GameChallengeGrid({
  className,
  style,
  layer,
  layerHint,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  layer: string;
  layerHint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`${layer}-${layerHint}-grid`}
      key={`${layer}-${layerHint}-grid`}
      className={`${className} noClicks`}
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
