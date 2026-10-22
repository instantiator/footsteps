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

/** The props the layout gave the (mocked) camera and canvas. */
const received = vi.hoisted(() => ({ canvas: [] as CanvasProps[], camera: [] as CameraProps[] }));

/** What the mocked camera does; `reportAspect` off leaves the layers waiting for a video shape. */
const settings = vi.hoisted(() => ({ reportAspect: true }));

vi.mock("../src/components/camera/CharacterCanvas", () => ({
  default: (props: CanvasProps) => {
    received.canvas.push(props);
    return <canvas data-testid="canvas" />;
  },
}));

// Reports a video shape and a stream straight away, as a real camera does once playing
vi.mock("../src/components/camera/CharacterCamera", async () => {
  const { useEffect } = await import("react");
  const { FakeMediaStream } = await import("./helpers/media");
  const MockCamera = (props: CameraProps) => {
    received.camera.push(props);
    const { onAspectChange, setStream } = props;
    useEffect(() => {
      if (settings.reportAspect) onAspectChange(1.5);
      setStream(new FakeMediaStream());
    }, [onAspectChange, setStream]);
    return null;
  };
  return { default: MockCamera };
});

beforeEach(() => {
  received.canvas.length = 0;
  received.camera.length = 0;
  settings.reportAspect = true;
});

const layers = {
  overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="o" id="overview-thing" />] },
  challenges: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="c" id="challenge-thing" />] },
};

/** The layout under test, in the provider stack a game supplies. */
const layout = (props: Partial<ComponentProps<typeof GameLayersLayout>> = {}) => (
  <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID}>
    <GameLayersLayout gameLayers={layers} camera={{ enabled: false, preview: false }} {...props} />
  </GameProviders>
);

const renderLayout = (props: Partial<ComponentProps<typeof GameLayersLayout>> = {}) => render(layout(props));

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

  it("draws no camera or canvas layers when the camera is disabled", () => {
    const { container } = renderLayout();
    expect(container.querySelector("#character-camera-layer")).toBeNull();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("draws the camera preview and the character canvas once the camera reports its aspect ratio", async () => {
    const { container } = renderLayout({ camera: { enabled: true, preview: true } });
    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(container.querySelector("#character-camera-layer")).not.toBeNull();
  });

  it("tints the camera silhouette by body part when debugging", async () => {
    renderLayout({ camera: { enabled: true, preview: true }, debug: true });
    await screen.findByTestId("canvas");
    expect(received.canvas.at(-1)?.maskType).toBe("colored");
  });

  it("hides the preview, but keeps the camera and canvas, when the preview is off", async () => {
    const { container } = renderLayout({ camera: { enabled: true, preview: false } });
    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(container.querySelector("#character-camera-layer")).toHaveStyle({ visibility: "hidden" });
  });

  it("clears a disabled camera's stream, so re-enabling starts a fresh one", async () => {
    const { rerender } = renderLayout({ camera: { enabled: true, preview: true } });
    await vi.waitFor(() => expect(received.camera.at(-1)?.stream).toBeDefined());

    rerender(layout({ camera: { enabled: false, preview: false } }));
    const firstCameraAfterReEnable = received.camera.length;
    rerender(layout({ camera: { enabled: true, preview: true } }));

    expect(received.camera[firstCameraAfterReEnable]?.stream).toBeUndefined();
  });

  it("keeps the display layers hidden until the camera reports its aspect ratio", () => {
    settings.reportAspect = false;
    const { container } = renderLayout({ camera: { enabled: true, preview: true } });
    expect(container.querySelector("#overview-foreground-container")).toBeNull();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });
});
