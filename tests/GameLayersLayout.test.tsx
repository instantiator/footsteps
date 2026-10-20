import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type CharacterCamera from "../src/components/camera/CharacterCamera";
import type CharacterCanvas from "../src/components/camera/CharacterCanvas";
import GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";

type CanvasProps = ComponentProps<typeof CharacterCanvas>;
type CameraProps = ComponentProps<typeof CharacterCamera>;

/** The props the layout gave the (mocked) canvas. */
const received = vi.hoisted(() => ({ canvas: [] as CanvasProps[] }));

vi.mock("../src/components/camera/CharacterCanvas", () => ({
  default: (props: CanvasProps) => {
    received.canvas.push(props);
    return <canvas data-testid="canvas" />;
  },
}));

// Reports a video shape straight away, as a real camera does once playing, so the layout shows its layers
vi.mock("../src/components/camera/CharacterCamera", async () => {
  const { useEffect } = await import("react");
  const MockCamera = ({ onAspectChange }: CameraProps) => {
    useEffect(() => onAspectChange(1.5), [onAspectChange]);
    return null;
  };
  return { default: MockCamera };
});

beforeEach(() => {
  received.canvas.length = 0;
});

const layers = {
  overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="o" id="overview-thing" />] },
  challenges: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="c" id="challenge-thing" />] },
};

const renderLayout = (props: Partial<ComponentProps<typeof GameLayersLayout>> = {}) =>
  render(
    <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
      <GameLayersLayout gameLayers={layers} cameraLayer={{ enabled: false }} {...props} />
    </GameProviders>,
  );

describe("GameLayersLayout", () => {
  it.each([
    ["overview-thing", "overview"],
    ["challenge-thing", "challenges"],
  ])("reports a click on #%s as coming from the %s layer", (targetId, layerId) => {
    const onElementClick = vi.fn<(layerId: string, targetId: string) => boolean>();
    const { container } = renderLayout({ onElementClick });
    fireEvent.click(container.querySelector(`#${targetId}`)!);
    expect(onElementClick).toHaveBeenCalledExactlyOnceWith(layerId, targetId);
  });

  it("ignores clicks on elements with no id", () => {
    const onElementClick = vi.fn<(layerId: string, targetId: string) => boolean>();
    renderLayout({
      onElementClick,
      gameLayers: {
        overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="n">anonymous</span>] },
      },
    });
    fireEvent.click(screen.getByText("anonymous"));
    expect(onElementClick).not.toHaveBeenCalled();
  });

  it("shows the debug layer only when debugging", () => {
    const { container, unmount } = renderLayout({ debug: false });
    expect(container.querySelector("#debug-overlay-container")).toBeNull();
    unmount();
    expect(renderLayout({ debug: true }).container.querySelector("#debug-overlay-container")).not.toBeNull();
  });

  it("draws no camera layers when the camera is disabled", () => {
    const { container } = renderLayout();
    expect(container.querySelector("#character-camera-layer")).toBeNull();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("draws the character canvas once the camera reports its aspect ratio", async () => {
    renderLayout({ cameraLayer: { enabled: true } });
    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(received.canvas.at(-1)?.maskType).toBe("binary");
  });

  it("tints the camera silhouette by body part when debugging", async () => {
    renderLayout({ cameraLayer: { enabled: true }, debug: true });
    await screen.findByTestId("canvas");
    expect(received.canvas.at(-1)?.maskType).toBe("colored");
  });
});
