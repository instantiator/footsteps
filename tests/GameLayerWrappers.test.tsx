import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameLayerWrapper } from "../src/components/core/layout/GameLayerWrappers";

const renderLayer = () => {
  const clickHandler = vi.fn();
  render(
    <GameLayerWrapper
      zIndex={1}
      layer="overview"
      layerHint="foreground"
      clickHandler={clickHandler}
      nodes={[
        <img key="stone" id="stages-link-stage-1" role="button" tabIndex={0} alt="Stage 1: play" />,
        <input key="answer" id="answer" aria-label="Answer" />,
      ]}
    />,
  );
  const targetIds = () => clickHandler.mock.calls.map(([event]) => (event.target as HTMLElement).id);
  return { clickHandler, targetIds };
};

describe("GameLayerWrapper keyboard delegation", () => {
  it("treats Enter and Space on a template button like a click on it", () => {
    const { targetIds } = renderLayer();
    const stone = screen.getByRole("button", { name: "Stage 1: play" });
    fireEvent.keyDown(stone, { key: "Enter" });
    fireEvent.keyDown(stone, { key: " " });
    expect(targetIds()).toEqual(["stages-link-stage-1", "stages-link-stage-1"]);
  });

  it("ignores other keys, and leaves text inputs their own keys", () => {
    const { clickHandler } = renderLayer();
    fireEvent.keyDown(screen.getByRole("button", { name: "Stage 1: play" }), { key: "a" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Answer" }), { key: " " });
    expect(clickHandler).not.toHaveBeenCalled();
  });
});
