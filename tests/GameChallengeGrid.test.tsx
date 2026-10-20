import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GameChallengeGrid from "../src/components/core/layout/GameChallengeGrid";

const renderGrid = (className?: string) =>
  render(
    <GameChallengeGrid layer="challenges" layerHint="foreground" className={className}>
      <span>one</span>
      <span>two</span>
      <span>three</span>
    </GameChallengeGrid>,
  );

describe("GameChallengeGrid", () => {
  it("puts each child in its own identified column, in order", () => {
    const { container } = renderGrid();
    const columns = [0, 1, 2].map((i) => container.querySelector(`#challenges-foreground-grid-child-${i}`));
    expect(columns.map((column) => column?.textContent)).toEqual(["one", "two", "three"]);
    expect(container.querySelector("#challenges-foreground-grid-child-3")).toBeNull();
  });

  it("applies the given class, and lets clicks through to the children", () => {
    const grid = renderGrid("innerStyle").container.querySelector("#challenges-foreground-grid")!;
    expect(grid).toHaveClass("innerStyle", "noClicks");
  });

  it("does not add the class 'undefined' when no className is given", () => {
    const grid = renderGrid().container.querySelector("#challenges-foreground-grid")!;
    expect(grid.classList).not.toContain("undefined");
    expect(grid).toHaveClass("noClicks");
  });
});
