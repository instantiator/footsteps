import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bodyParts from "../src/assets/body-seg-parts.json";
import type CharacterCamera from "../src/components/camera/CharacterCamera";
import type CharacterCanvas from "../src/components/camera/CharacterCanvas";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import type { GameInteractionTarget } from "../src/entities/data/displays/GameDisplayData";
import { SMALL_GAME_ID, smallRepository } from "./data/SmallGame";
import GameProviders from "./helpers/GameProviders";
import { setReducedMotion } from "./helpers/motion";

type CanvasProps = ComponentProps<typeof CharacterCanvas>;
type CameraProps = ComponentProps<typeof CharacterCamera>;

/** The props the layout gave the (mocked) camera and canvas. */
const received = vi.hoisted(() => ({ canvas: [] as CanvasProps[], camera: [] as CameraProps[] }));

/**
 * What the mocked camera does: `reportAspect` off leaves the layers waiting for a video shape,
 * and `fail` reports that the camera couldn't start.
 */
const settings = vi.hoisted(() => ({ reportAspect: true, fail: false }));

vi.mock("../src/components/camera/CharacterCanvas", () => ({
  default: (props: CanvasProps) => {
    received.canvas.push(props);
    return <canvas data-testid="canvas" ref={props.canvasRef} />;
  },
}));

// Reports a video shape and a stream straight away, as a real camera does once playing
vi.mock("../src/components/camera/CharacterCamera", async () => {
  const { useEffect } = await import("react");
  const { FakeMediaStream } = await import("./helpers/media");
  const MockCamera = (props: CameraProps) => {
    received.camera.push(props);
    const { onAspectChange, setStream, onError } = props;
    useEffect(() => {
      if (settings.fail) return onError();
      if (settings.reportAspect) onAspectChange(1.5);
      setStream(new FakeMediaStream());
    }, [onAspectChange, setStream, onError]);
    return null;
  };
  return { default: MockCamera };
});

beforeEach(() => {
  received.canvas.length = 0;
  received.camera.length = 0;
  settings.reportAspect = true;
  settings.fail = false;
});

afterEach(() => {
  vi.useRealTimers();
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

/** An 8px mask with one opaque body part at the given pixel. */
const maskWithPart = (value: number, x: number, y: number): PlayerFrame["mask"] => {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  const i = (y * width + x) * 4;
  data[i] = value;
  data[i + 3] = 255;
  return { data, width, height };
};

/** A player whose hand is at the given mask pixel, and whose feet are out of view. */
const playerWithHandAt = (x: number, y: number): PlayerFrame => ({
  id: 0,
  mask: maskWithPart(bodyParts.LEFT_HAND.maskValue, x, y),
  feet: null,
});

const stubRect = (element: Element, rect: DOMRect) => vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);

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

  it("fits the game viewport to the camera's aspect ratio, so the whole display is in view", async () => {
    const { container, rerender } = renderLayout();
    const viewport = () => container.querySelector("#game-viewport");
    expect(viewport()).not.toBeNull();
    expect(viewport()).not.toHaveStyle({ aspectRatio: "1.5" });
    expect(viewport()?.querySelector("#overview-foreground-container")).not.toBeNull();

    rerender(layout({ camera: { enabled: true, preview: true } }));
    await screen.findByTestId("canvas");

    expect(viewport()).toHaveStyle({ aspectRatio: "1.5" });
    expect(viewport()?.querySelector("#overview-foreground-container")).not.toBeNull();
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

describe("GameLayersLayout without a working camera", () => {
  it("shows the display without the camera when it can't start", async () => {
    settings.fail = true;
    const { container } = renderLayout({ camera: { enabled: true, preview: true } });

    await vi.waitFor(() => expect(container.querySelector("#overview-foreground-container")).not.toBeNull());
    expect(container.querySelector("#character-camera-layer")).toBeNull();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("moves on to a camera display, without the camera, when it can't start", () => {
    setReducedMotion(true);
    settings.fail = true;
    const title = { overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="t">title</span>] } };
    const stages = {
      overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="s">stages</span>] },
    };
    const { rerender } = renderLayout({ gameLayers: title, displayKey: "title" });

    rerender(layout({ camera: { enabled: true, preview: true }, gameLayers: stages, displayKey: "stages" }));

    expect(screen.getByText("stages")).toBeInTheDocument();
    expect(screen.queryByText("title")).toBeNull();
  });
});

describe("GameLayersLayout display transitions", () => {
  /** A single overview layer, labelled so tests can tell displays apart. */
  const display = (text: string) => ({
    overview: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key={text}>{text}</span>] },
  });

  /** The scene wrapper that fades the display and camera layers together. */
  const sceneOf = (container: HTMLElement) => container.querySelector<HTMLElement>(".gameScene")!;

  it("fades the old display out, swaps, and fades the new display in", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container, rerender } = renderLayout({ gameLayers: display("old display"), displayKey: "old" });
    const scene = () => sceneOf(container);

    rerender(layout({ gameLayers: display("new display"), displayKey: "new" }));

    expect(screen.getByText("old display")).toBeInTheDocument();
    expect(screen.queryByText("new display")).toBeNull();
    expect(scene()).toHaveStyle({ opacity: "0", pointerEvents: "none" });
    expect(scene()).toHaveAttribute("inert");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText("old display")).toBeNull();
    expect(screen.getByText("new display")).toBeInTheDocument();
    expect(scene()).toHaveStyle({ opacity: "1", pointerEvents: "none" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(scene().style.pointerEvents).toBe("");
    expect(scene()).not.toHaveAttribute("inert");
  });

  it("swaps displays immediately when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { rerender } = renderLayout({ gameLayers: display("old display"), displayKey: "old" });

    rerender(layout({ gameLayers: display("new display"), displayKey: "new" }));

    expect(screen.getByText("new display")).toBeInTheDocument();
    expect(screen.queryByText("old display")).toBeNull();
  });

  it("updates content in the same display without fading", () => {
    setReducedMotion(false);
    const { container, rerender } = renderLayout({ gameLayers: display("before"), displayKey: "same" });

    rerender(layout({ gameLayers: display("after"), displayKey: "same" }));

    expect(screen.getByText("after")).toBeInTheDocument();
    expect(screen.queryByText("before")).toBeNull();
    expect(sceneOf(container)).toHaveStyle({ opacity: "1" });
  });

  it("reshapes for the camera over two seconds, holding the old display until the fade", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container, rerender } = renderLayout({ gameLayers: display("title"), displayKey: "title" });
    const viewport = container.querySelector<HTMLElement>("#game-viewport")!;
    stubRect(viewport, new DOMRect(0, 0, 100, 100));
    stubRect(viewport.parentElement!, new DOMRect(0, 0, 100, 100));

    rerender(
      layout({ camera: { enabled: true, preview: true }, gameLayers: display("overview"), displayKey: "overview" }),
    );

    expect(viewport).toHaveClass("gameViewportReshaping");
    expect(viewport).toHaveStyle({ aspectRatio: "1.5" });
    expect(viewport.style.getPropertyValue("--reshape-from")).toBe("1 / 1");
    expect(viewport.style.getPropertyValue("--reshape-to")).toBe("1.5 / 1");
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.queryByText("overview")).toBeNull();
    expect(container.querySelector("#character-camera-layer")).toHaveStyle({ visibility: "hidden" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(sceneOf(container)).toHaveStyle({ opacity: "0", pointerEvents: "none" });
    expect(screen.getByText("title")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText("title")).toBeNull();
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(viewport).not.toHaveClass("gameViewportReshaping");
    expect(viewport).toHaveStyle({ aspectRatio: "1.5" });
    expect(container.querySelector("#character-camera-layer")).toHaveStyle({ visibility: "visible" });
    expect(sceneOf(container)).toHaveStyle({ opacity: "1", pointerEvents: "none" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(sceneOf(container)).not.toHaveAttribute("inert");
  });

  it("reshapes back to the container when the camera turns off", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container, rerender } = renderLayout({
      camera: { enabled: true, preview: true },
      gameLayers: display("overview"),
      displayKey: "overview",
    });
    const viewport = container.querySelector<HTMLElement>("#game-viewport")!;
    stubRect(viewport, new DOMRect(0, 0, 150, 100));
    stubRect(viewport.parentElement!, new DOMRect(0, 0, 100, 100));
    expect(viewport).toHaveStyle({ aspectRatio: "1.5" });

    rerender(layout({ camera: { enabled: false, preview: false }, gameLayers: display("stage"), displayKey: "stage" }));

    expect(viewport).toHaveClass("gameViewportReshaping");
    expect(viewport).toHaveStyle({ aspectRatio: "1" });
    expect(viewport.style.getPropertyValue("--reshape-from")).toBe("1.5 / 1");
    expect(viewport.style.getPropertyValue("--reshape-to")).toBe("1 / 1");
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(received.camera.at(-1)?.stream).toBeDefined();
    expect(container.querySelector("#character-camera-layer")).toHaveStyle({ visibility: "visible" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(sceneOf(container)).toHaveStyle({ opacity: "0" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("stage")).toBeInTheDocument();
    expect(viewport).not.toHaveClass("gameViewportReshaping");
    expect(viewport.style.aspectRatio).toBe("");
    expect(sceneOf(container)).toHaveStyle({ opacity: "1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(sceneOf(container)).not.toHaveAttribute("inert");
  });

  it("keeps the old display until the camera reports its shape", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    settings.reportAspect = false;
    const { container, rerender } = renderLayout({ gameLayers: display("title"), displayKey: "title" });
    const viewport = container.querySelector<HTMLElement>("#game-viewport")!;
    stubRect(viewport, new DOMRect(0, 0, 100, 100));
    stubRect(viewport.parentElement!, new DOMRect(0, 0, 100, 100));

    rerender(
      layout({ camera: { enabled: true, preview: true }, gameLayers: display("overview"), displayKey: "overview" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.queryByText("overview")).toBeNull();
    expect(viewport).not.toHaveClass("gameViewportReshaping");
    expect(viewport.style.aspectRatio).toBe("");

    act(() => received.camera.at(-1)!.onAspectChange!(1.5));
    expect(viewport).toHaveClass("gameViewportReshaping");
    expect(viewport).toHaveStyle({ aspectRatio: "1.5" });
    expect(viewport.style.getPropertyValue("--reshape-from")).toBe("1 / 1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(viewport).not.toHaveClass("gameViewportReshaping");
  });

  it("reshapes without fading when the display stays the same", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container, rerender } = renderLayout({ gameLayers: display("overview"), displayKey: "overview" });
    const viewport = container.querySelector<HTMLElement>("#game-viewport")!;
    stubRect(viewport, new DOMRect(0, 0, 100, 100));
    stubRect(viewport.parentElement!, new DOMRect(0, 0, 100, 100));

    rerender(
      layout({ camera: { enabled: true, preview: true }, gameLayers: display("overview"), displayKey: "overview" }),
    );
    expect(viewport).toHaveClass("gameViewportReshaping");
    expect(viewport.style.getPropertyValue("--reshape-from")).toBe("1 / 1");
    expect(viewport.style.getPropertyValue("--reshape-to")).toBe("1.5 / 1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(sceneOf(container)).toHaveStyle({ opacity: "1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(viewport).not.toHaveClass("gameViewportReshaping");
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(sceneOf(container)).not.toHaveAttribute("inert");
  });

  it("skips the reshape when reduced motion is preferred", async () => {
    setReducedMotion(true);
    const { container, rerender } = renderLayout({ gameLayers: display("title"), displayKey: "title" });
    const viewport = container.querySelector<HTMLElement>("#game-viewport")!;

    rerender(
      layout({ camera: { enabled: true, preview: true }, gameLayers: display("overview"), displayKey: "overview" }),
    );

    expect(await screen.findByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(viewport).toHaveStyle({ aspectRatio: "1.5" });
    expect(viewport).not.toHaveClass("gameViewportReshaping");
  });
});

describe("GameLayersLayout camera interactions", () => {
  /** Renders the layout with the camera on and the given targets, and returns its canvas. */
  const renderWithCamera = async (
    props: Partial<ComponentProps<typeof GameLayersLayout>> = {},
  ): Promise<{
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    rerender: (ui: ReactElement) => void;
  }> => {
    const { container, rerender } = renderLayout({ camera: { enabled: true, preview: true }, ...props });
    await screen.findByTestId("canvas");
    return { container, canvas: container.querySelector("canvas")!, rerender };
  };

  /** Sends one camera frame to the layout. */
  const sendPlayers = (players: PlayerFrame[], timestamp = 1000) => {
    act(() => received.canvas.at(-1)!.onPlayersChange!(players, timestamp));
  };

  it("reports a camera interaction when a body part covers an element", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      interactionTargets: { "overview-thing": { stage: "stage-1", interactions: ["hand"] } },
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    // The element covers the screen's left half, so the mask's right half, after mirroring
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(6, 1)]);

    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith({ elementId: "overview-thing", interaction: "hand" });
  });

  it("reports nothing when the target's element is not in the document", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      interactionTargets: { "not-on-screen": { stage: "stage-1", interactions: ["hand"] } },
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));

    sendPlayers([playerWithHandAt(1, 1)]);

    expect(onPlayerInteraction).not.toHaveBeenCalled();
    expect(container.querySelector("#not-on-screen")).toBeNull();
  });

  it("fires again when a player leaves and comes back", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      interactionTargets: { "overview-thing": { stage: "stage-1", interactions: ["hand"] } },
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 100, 100));

    sendPlayers([playerWithHandAt(1, 1)]);
    sendPlayers([], 1100); // the player is gone, so the monitor is dropped
    sendPlayers([playerWithHandAt(1, 1)], 1200);

    expect(onPlayerInteraction).toHaveBeenCalledTimes(2);
  });

  it("maps element bounds using the canvas's position on the page", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      interactionTargets: { "overview-thing": { stage: "stage-1", interactions: ["hand"] } },
      onPlayerInteraction,
    });
    // The canvas sits away from the origin; the element covers its top-left quarter
    stubRect(canvas, new DOMRect(100, 100, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(100, 100, 50, 50));

    sendPlayers([playerWithHandAt(6, 1)]);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();

    // The same hand lower down is outside the element, so it does not fire
    sendPlayers([playerWithHandAt(6, 6)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();
  });

  it("ignores camera interactions while a display change is fading", async () => {
    setReducedMotion(false);
    const onPlayerInteraction = vi.fn();
    const interactionTargets: Record<string, GameInteractionTarget> = {
      "overview-thing": { stage: "stage-1", interactions: ["hand"] },
    };
    const props = { interactionTargets, onPlayerInteraction, displayKey: "old" };
    const { container, canvas, rerender } = await renderWithCamera(props);
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    vi.useFakeTimers();
    rerender(layout({ camera: { enabled: true, preview: true }, ...props, displayKey: "new" }));

    sendPlayers([playerWithHandAt(6, 1)], 1000);
    expect(onPlayerInteraction).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    sendPlayers([playerWithHandAt(6, 1)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith({ elementId: "overview-thing", interaction: "hand" });
  });
});
