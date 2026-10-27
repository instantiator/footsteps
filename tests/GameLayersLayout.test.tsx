import { act, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type CharacterCamera from "../src/components/camera/CharacterCamera";
import type CharacterCanvas from "../src/components/camera/CharacterCanvas";
import type { PlayerFrame } from "../src/components/camera/PlayerMonitor";
import GameLayersLayout from "../src/components/core/layout/GameLayersLayout";
import type { AppConfig } from "../src/config/AppConfig";
import type { CameraRuleTarget } from "../src/components/core/layout/PlayerInteractionHook";
import { noKeyPoints } from "../src/vision/VisionTypes";
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

/** The scope the test layers' overview display has, so camera rules can find its elements. */
const SCOPE = "overview:game-overview-stages";

const layers = {
  overview: {
    backgroundLayerNodes: undefined,
    foregroundLayerNodes: [
      <div key="o" data-display-scope={SCOPE}>
        <span id="overview-thing" />
      </div>,
    ],
  },
  challenges: { backgroundLayerNodes: undefined, foregroundLayerNodes: [<span key="c" id="challenge-thing" />] },
};

/** The layout under test, in the provider stack a game supplies. */
const layout = (props: Partial<ComponentProps<typeof GameLayersLayout>> = {}, config: Partial<AppConfig> = {}) => (
  <GameProviders repository={smallRepository} gameId={SMALL_GAME_ID} config={config}>
    <GameLayersLayout gameLayers={layers} camera={{ enabled: false, preview: false }} {...props} />
  </GameProviders>
);

const renderLayout = (props: Partial<ComponentProps<typeof GameLayersLayout>> = {}, config: Partial<AppConfig> = {}) =>
  render(layout(props, config));

/** A player in an 8px mask whose only pixel is their left hand, at the given pixel; their feet are out of view. */
const playerWithHandAt = (x: number, y: number): PlayerFrame => {
  const width = 8;
  const height = 8;
  const mask = new Uint8Array(width * height);
  mask[y * width + x] = 1;
  return { id: 0, mask, keyPoints: { ...noKeyPoints(), leftHand: { x, y } }, scale: 0, width, height, feet: null };
};

/** A camera rule watching the overview's element for hands, ignoring covering (jsdom can't hit-test). */
const handRule = (overrides: Partial<CameraRuleTarget> = {}): CameraRuleTarget => ({
  scope: SCOPE,
  ruleIndex: 0,
  selector: "#overview-thing",
  interactions: ["hand"],
  threshold: 1,
  includeCovered: true,
  ...overrides,
});

/** What the layout reports when a hand touches the overview's element. */
const handOnThing = (container: HTMLElement) => ({
  scope: SCOPE,
  ruleIndex: 0,
  element: container.querySelector("#overview-thing"),
  interaction: "hand",
});

const stubRect = (element: Element, rect: DOMRect) => vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);

describe("GameLayersLayout", () => {
  it("lets pointer events through the display layers, so displays handle their own", () => {
    const { container } = renderLayout();
    expect(container.querySelectorAll('[id$="ground-container"]').length).toBeGreaterThan(0);
    for (const layer of container.querySelectorAll('[id$="ground-container"], [id*="-grid"]')) {
      expect(layer.className, layer.id).toContain("noClicks");
    }
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

  it("doesn't re-render the game for each camera frame unless the debug overlay shows the feet", async () => {
    renderLayout({ camera: { enabled: true, preview: true }, debug: false });
    await screen.findByTestId("canvas");
    const canvas = received.canvas.at(-1)!;
    expect(canvas.onFeetPositionsChange).toBeUndefined();
    const renders = received.canvas.length;

    act(() => canvas.onPlayersChange?.([playerWithHandAt(1, 1)], 0));

    expect(received.canvas).toHaveLength(renders);
  });

  it("reports the feet to the debug overlay when debugging", async () => {
    renderLayout({ camera: { enabled: true, preview: true }, debug: true });
    await screen.findByTestId("canvas");
    expect(received.canvas.at(-1)?.onFeetPositionsChange).toBeDefined();
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
    config: Partial<AppConfig> = {},
  ): Promise<{
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    rerender: (ui: ReactElement) => void;
  }> => {
    const { container, rerender } = renderLayout({ camera: { enabled: true, preview: true }, ...props }, config);
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
      cameraRules: [handRule()],
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    // The element covers the screen's left half, so the mask's right half, after mirroring
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(0, 7)], 900); // outside the element, so the hand then moves in
    sendPlayers([playerWithHandAt(6, 1)]);

    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith(handOnThing(container));
  });

  it("waits for the configured number of frames before reporting an interaction", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera(
      { cameraRules: [handRule()], onPlayerInteraction },
      { visionSmoothing: true, visionStableFrames: 2 },
    );
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(0, 7)], 900);
    sendPlayers([playerWithHandAt(6, 1)]);
    expect(onPlayerInteraction).not.toHaveBeenCalled(); // one frame could be a flicker

    sendPlayers([playerWithHandAt(6, 1)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith(handOnThing(container));
  });

  it("ignores a hand that is already inside the element when the camera starts", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      cameraRules: [handRule()],
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(6, 1)]);
    sendPlayers([playerWithHandAt(6, 1)], 1100);

    expect(onPlayerInteraction).not.toHaveBeenCalled();
  });

  it("reports nothing when the target's element is not in the document", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      cameraRules: [handRule({ selector: "#not-on-screen" })],
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
      cameraRules: [handRule()],
      onPlayerInteraction,
    });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(0, 7)], 900);
    sendPlayers([playerWithHandAt(6, 1)]);
    sendPlayers([], 1100); // the player is gone, so the monitor is dropped
    sendPlayers([playerWithHandAt(0, 7)], 1200);
    sendPlayers([playerWithHandAt(6, 1)], 1300);

    expect(onPlayerInteraction).toHaveBeenCalledTimes(2);
  });

  it("never fires for a held player, and keeps their monitor until they are found again", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({ cameraRules: [handRule()], onPlayerInteraction });
    stubRect(canvas, new DOMRect(0, 0, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(0, 0, 50, 50));

    sendPlayers([playerWithHandAt(0, 7)], 900);
    sendPlayers([{ ...playerWithHandAt(6, 1), held: { opacity: 1 } }]); // where they last were, not where they are
    expect(onPlayerInteraction).not.toHaveBeenCalled();

    // Found again with the hand inside: the monitor that saw it outside reports it moving in
    sendPlayers([playerWithHandAt(6, 1)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith(handOnThing(container));
  });

  it("maps element bounds using the canvas's position on the page", async () => {
    const onPlayerInteraction = vi.fn();
    const { container, canvas } = await renderWithCamera({
      cameraRules: [handRule()],
      onPlayerInteraction,
    });
    // The canvas sits away from the origin; the element covers its top-left quarter
    stubRect(canvas, new DOMRect(100, 100, 100, 100));
    stubRect(container.querySelector("#overview-thing")!, new DOMRect(100, 100, 50, 50));

    sendPlayers([playerWithHandAt(0, 7)], 900);
    sendPlayers([playerWithHandAt(6, 1)]);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();

    // The same hand lower down is outside the element, so it does not fire
    sendPlayers([playerWithHandAt(6, 6)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();
  });

  it("ignores camera interactions while a display change is fading", async () => {
    setReducedMotion(false);
    const onPlayerInteraction = vi.fn();
    const props = { cameraRules: [handRule()], onPlayerInteraction, displayKey: "old" };
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

    sendPlayers([playerWithHandAt(0, 7)], 1100);
    sendPlayers([playerWithHandAt(6, 1)], 1200);
    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith(handOnThing(container));
  });
});

describe("GameLayersLayout camera rules", () => {
  /** What `document.elementFromPoint` returns; jsdom has no layout, so the tests decide what is on top. */
  let topmost: Element | null = null;
  beforeEach(() => {
    topmost = null;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => topmost });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "elementFromPoint");
  });

  /** Balloons, two with no id, in the overview display, and a cover over them. */
  const balloons = (count = 2) => ({
    overview: {
      backgroundLayerNodes: undefined,
      foregroundLayerNodes: [
        <div key="o" data-display-scope={SCOPE}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="balloon" data-n={i} />
          ))}
          <span id="cover" />
        </div>,
      ],
    },
  });

  const renderRules = async (cameraRules: CameraRuleTarget[], gameLayers = balloons()) => {
    const onPlayerInteraction = vi.fn();
    const view = renderLayout({
      camera: { enabled: true, preview: true },
      cameraRules,
      onPlayerInteraction,
      gameLayers,
    });
    await screen.findByTestId("canvas");
    stubRect(view.container.querySelector("canvas")!, new DOMRect(0, 0, 100, 100));
    const stubAll = () =>
      view.container.querySelectorAll(".balloon").forEach((el) => stubRect(el, new DOMRect(0, 0, 50, 50)));
    stubAll();
    return { ...view, onPlayerInteraction, stubAll };
  };
  const send = (players: PlayerFrame[], timestamp: number) =>
    act(() => received.canvas.at(-1)!.onPlayersChange!(players, timestamp));
  /** A hand moving from outside the balloons onto them. */
  const handIn = (from = 900) => {
    send([playerWithHandAt(0, 7)], from);
    send([playerWithHandAt(6, 1)], from + 100);
  };
  const balloonRule = (overrides: Partial<CameraRuleTarget> = {}) =>
    handRule({ selector: ".balloon", includeCovered: false, ...overrides });

  it("fires for every element a class selector matches, including those without an id", async () => {
    const { container, onPlayerInteraction } = await renderRules([balloonRule({ includeCovered: true })]);
    handIn();
    expect(onPlayerInteraction.mock.calls.map(([event]) => event.element)).toEqual(
      Array.from(container.querySelectorAll(".balloon")),
    );
  });

  it("keeps an element's key across frames, so a hand that stays doesn't fire again", async () => {
    const { onPlayerInteraction } = await renderRules([balloonRule({ includeCovered: true })], balloons(1));
    handIn();
    send([playerWithHandAt(6, 1)], 1100);
    send([playerWithHandAt(6, 1)], 1200);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();
  });

  it("counts an element added after the first frame, or one replaced, as new", async () => {
    const { container, onPlayerInteraction, rerender, stubAll } = await renderRules(
      [balloonRule({ includeCovered: true })],
      balloons(0),
    );
    send([playerWithHandAt(6, 1)], 900);
    rerender(
      layout({
        camera: { enabled: true, preview: true },
        cameraRules: [balloonRule({ includeCovered: true })],
        onPlayerInteraction,
        gameLayers: balloons(1),
      }),
    );
    stubAll();
    send([playerWithHandAt(6, 1)], 1000);
    expect(onPlayerInteraction).toHaveBeenCalledOnce();

    const first = container.querySelector(".balloon")!;
    first.replaceWith(first.cloneNode());
    stubAll();
    send([playerWithHandAt(6, 1)], 1100);
    expect(onPlayerInteraction).toHaveBeenCalledTimes(2);
  });

  it("ignores an element that something else covers, as a click would", async () => {
    const { container, onPlayerInteraction } = await renderRules([balloonRule()], balloons(1));
    topmost = container.querySelector("#cover");
    handIn();
    expect(onPlayerInteraction).not.toHaveBeenCalled();
  });

  it("fires for an element on top, or with something inside it on top", async () => {
    const { container, onPlayerInteraction } = await renderRules([balloonRule()], balloons(1));
    const balloon = container.querySelector(".balloon")!;
    const inner = balloon.appendChild(document.createElement("b"));
    topmost = inner;
    handIn();
    expect(onPlayerInteraction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ element: balloon }));
  });

  it("ignores covering for a rule with includeCovered", async () => {
    const { container, onPlayerInteraction } = await renderRules([balloonRule({ includeCovered: true })], balloons(1));
    topmost = container.querySelector("#cover");
    handIn();
    expect(onPlayerInteraction).toHaveBeenCalledOnce();
  });

  it("only looks in the rule's own display", async () => {
    const { onPlayerInteraction } = await renderRules([
      balloonRule({ includeCovered: true, scope: "stage:s1:shared" }),
    ]);
    handIn();
    expect(onPlayerInteraction).not.toHaveBeenCalled();
  });
});
