import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMouseFeet, type FeetAt } from "../src/components/core/layout/MouseFeetHook";
import type { CameraRuleEvent, CameraRuleTarget } from "../src/components/core/layout/PlayerInteractionHook";
import type { CameraInteraction } from "../src/components/camera/PlayerMonitor";
import { trackPointer } from "../src/util/PointerPosition";

const SCOPE = "challenge:lava/floor/challenge-in-progress";

/** Where each element sits on the screen: #a on the left, #b on the right, #cover over the right half of #b. */
const BOXES: Record<string, [number, number, number, number]> = {
  a: [0, 0, 100, 100],
  b: [200, 0, 300, 100],
  cover: [250, 0, 300, 100],
};

/** A rule the feet can fire, on one element or anywhere. */
const rule = (
  interactions: CameraInteraction[],
  selector: string | undefined,
  options: Partial<CameraRuleTarget> = {},
): CameraRuleTarget => ({
  scope: SCOPE,
  run: 0,
  ruleIndex: 0,
  selector,
  interactions,
  threshold: 1,
  includeCovered: false,
  holdMs: 0,
  ...options,
});

/** Props for {@link Harness}. */
interface HarnessProps {
  rules: CameraRuleTarget[];
  onEvent: (event: CameraRuleEvent) => void;
  enabled?: boolean;
  onClick?: () => void;
  onFeet?: (at: FeetAt | null) => void;
}

/** A viewport holding one scene with #a, #b and the #cover over #b, fed to the hook. */
function Harness({ rules, onEvent, enabled = true, onClick, onFeet }: HarnessProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useMouseFeet(viewportRef, rules, onEvent, { enabled, onFeet });
  return (
    <div ref={viewportRef} data-testid="viewport" onClick={onClick}>
      <div data-scene-scope={SCOPE}>
        <span id="a" />
        <span id="b" />
        <span id="cover" />
      </div>
    </div>
  );
}

/** The topmost element at a point, by the boxes, later ones on top. */
const topmostAt = (x: number, y: number): Element | null => {
  const hits = Object.entries(BOXES).filter(([, [l, t, r, b]]) => x >= l && x < r && y >= t && y < b);
  const top = hits.at(-1);
  return top ? document.getElementById(top[0]) : null;
};

/** Moves the pointer over the page without the feet seeing it, as while they wait. */
const restAt = (x: number, y = 50) => fireEvent.pointerMove(window, { clientX: x, clientY: y });

/** The interactions fired, as `interaction@id`. */
const fired = (onEvent: ReturnType<typeof vi.fn<(event: CameraRuleEvent) => void>>) =>
  onEvent.mock.calls.map(([event]) => `${event.interaction}@${event.element?.id ?? "anywhere"}`);

/** Renders the harness and returns ways to move the pointer. */
const setup = (rules: CameraRuleTarget[], props: Partial<HarnessProps> = {}) => {
  const onEvent = vi.fn<(event: CameraRuleEvent) => void>();
  const view = render(<Harness rules={rules} onEvent={onEvent} {...props} />);
  for (const [id, [left, top, right, bottom]] of Object.entries(BOXES)) {
    vi.spyOn(document.getElementById(id)!, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top }),
    );
  }
  const viewport = view.getByTestId("viewport");
  const move = (x: number, y = 50, buttons = 0) => fireEvent.pointerMove(viewport, { clientX: x, clientY: y, buttons });
  const down = (x: number, y = 50) => fireEvent.pointerDown(viewport, { clientX: x, clientY: y, button: 0 });
  const up = (x: number, y = 50) => fireEvent.pointerUp(viewport, { clientX: x, clientY: y, button: 0 });
  /** A drag from one x to another, as the browser reports it, ending with its click. */
  const drag = (from: number, to: number) => {
    down(from);
    move((from + to) / 2, 50, 1);
    move(to, 50, 1);
    up(to);
    fireEvent.click(viewport);
  };
  // The first position only arms the feet
  move(150);
  return { onEvent, viewport, move, down, up, drag, view };
};

beforeEach(() => {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: topmostAt });
  trackPointer();
  fireEvent.pointerOut(window, { relatedTarget: null });
});

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.useRealTimers();
});

describe("useMouseFeet", () => {
  it("reports where the feet are, airborne through a jump, and nothing as they leave", () => {
    const onFeet = vi.fn();
    const { viewport, move, down, up } = setup([], { onFeet });
    move(20, 30);
    expect(onFeet).toHaveBeenLastCalledWith({ point: { x: 20, y: 30 }, airborne: false });

    down(20, 30);
    move(60, 30, 1);
    expect(onFeet).toHaveBeenLastCalledWith({ point: { x: 60, y: 30 }, airborne: true });
    up(70, 30);
    expect(onFeet).toHaveBeenLastCalledWith({ point: { x: 70, y: 30 }, airborne: false });

    fireEvent.pointerLeave(viewport);
    expect(onFeet).toHaveBeenLastCalledWith(null);
  });

  it("fires foot-enter and foot-exit once each as the pointer moves over and off", () => {
    const { onEvent, move } = setup([rule(["foot-enter", "foot-exit"], "#a")]);
    move(10);
    move(20);
    move(150);
    expect(fired(onEvent)).toEqual(["foot-enter@a", "foot-exit@a"]);
    expect(onEvent.mock.calls[0][0]).toMatchObject({ player: 1, scope: SCOPE, ruleIndex: 0 });
  });

  it("fires any-enter and any-exit when a rule asks, but not hand interactions", () => {
    const { onEvent, move } = setup([rule(["any-enter", "any-exit", "hand-enter"], "#a")]);
    move(10);
    move(150);
    expect(fired(onEvent)).toEqual(["any-enter@a", "any-exit@a"]);
  });

  it("enters and leaves what moves under a resting pointer, once each, on the frames that follow", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const { onEvent } = setup([rule(["foot-enter", "foot-exit"], "#a")]);
    restAt(150);
    vi.advanceTimersToNextFrame();
    expect(onEvent).not.toHaveBeenCalled();
    const a = vi.spyOn(document.getElementById("a")!, "getBoundingClientRect");
    a.mockReturnValue(DOMRect.fromRect({ x: 100, y: 0, width: 100, height: 100 }));
    BOXES.a = [100, 0, 200, 100];
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(fired(onEvent)).toEqual(["foot-enter@a"]);
    a.mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 100 }));
    BOXES.a = [0, 0, 100, 100];
    vi.advanceTimersToNextFrame();
    expect(fired(onEvent)).toEqual(["foot-enter@a", "foot-exit@a"]);
  });

  it("enters what is under the pointer as the feet start", () => {
    restAt(10);
    const onEvent = vi.fn<(event: CameraRuleEvent) => void>();
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(DOMRect.fromRect({ width: 100, height: 100 }));
    render(<Harness rules={[rule(["foot-enter"], "#a")]} onEvent={onEvent} />);
    rect.mockRestore();
    expect(fired(onEvent)).toEqual(["foot-enter@a"]);
  });

  it("ignores a covered element, unless the rule includes covered ones", () => {
    const covered = setup([rule(["foot-enter"], "#b")]);
    covered.move(260);
    expect(fired(covered.onEvent)).toEqual([]);
    covered.view.unmount();

    const included = setup([rule(["foot-enter"], "#b", { includeCovered: true })]);
    included.move(260);
    expect(fired(included.onEvent)).toEqual(["foot-enter@b"]);
  });

  it("stands on a floor area only where it is drawn, not anywhere in its wider box", () => {
    // #a is drawn in perspective over the left half of its box
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: (x: number) => (x < 50 ? [document.getElementById("a")] : []),
    });
    const { onEvent, move, view } = setup([rule(["foot-enter"], "#a", { includeCovered: true })]);
    view.container.querySelector("#a")!.setAttribute("data-floor-area", "0 0 50 50");
    move(75);
    expect(onEvent).not.toHaveBeenCalled();
    move(25);
    expect(fired(onEvent)).toEqual(["foot-enter@a"]);
    Reflect.deleteProperty(document, "elementsFromPoint");
  });

  it("waits out a rule's hold before entering, and forgets it if the feet move off first", () => {
    vi.useFakeTimers();
    const { onEvent, move } = setup([rule(["foot-enter"], "#a", { holdMs: 500 })]);
    move(10);
    vi.advanceTimersByTime(400);
    move(150);
    vi.advanceTimersByTime(500);
    expect(onEvent).not.toHaveBeenCalled();

    move(10);
    vi.advanceTimersByTime(500);
    expect(fired(onEvent)).toEqual(["foot-enter@a"]);
  });

  it("treats a drag as a jump: exits on take-off, then from, onto and entering where it lands, and no click", () => {
    const onClick = vi.fn();
    const rules = [
      rule(["foot-enter", "foot-exit", "jump-from"], "#a"),
      rule(["foot-enter", "jump-onto"], "#b", { ruleIndex: 1, includeCovered: true }),
    ];
    const { onEvent, move, drag } = setup(rules, { onClick });
    move(10);
    onEvent.mockClear();
    drag(10, 210);
    expect(fired(onEvent)).toEqual(["foot-exit@a", "jump-from@a", "jump-onto@b", "foot-enter@b"]);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires jump for an element the jump leaves from and lands on, and for a rule on no element", () => {
    const { onEvent, move, drag } = setup([rule(["jump"], "#a"), rule(["jump"], undefined, { ruleIndex: 1 })]);
    move(10);
    drag(10, 60);
    expect(fired(onEvent)).toEqual(["jump@a", "jump@anywhere"]);
  });

  it("keeps a press that wobbles a few pixels a click, not a jump", () => {
    const onClick = vi.fn();
    const { onEvent, move, down, up, viewport } = setup([rule(["jump", "foot-exit"], "#a")], { onClick });
    move(10);
    down(10);
    move(13, 52, 1);
    up(13, 52);
    fireEvent.click(viewport);
    expect(onEvent).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fires nothing while disabled", () => {
    const { onEvent, move, drag } = setup([rule(["foot-enter", "jump"], "#a")], { enabled: false });
    move(10);
    drag(10, 60);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("fires the exits of everything entered when the pointer leaves the game", () => {
    const { onEvent, move, viewport } = setup([rule(["foot-exit"], "#a")]);
    move(10);
    fireEvent.pointerLeave(viewport);
    expect(fired(onEvent)).toEqual(["foot-exit@a"]);
  });

  it("starts a scene's targets afresh when it resets, without firing exits, and enters again where the feet rest", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const rules = [rule(["foot-enter", "foot-exit"], "#a")];
    const { onEvent, move, view } = setup(rules);
    move(10);
    onEvent.mockClear();
    view.rerender(<Harness rules={[{ ...rules[0], run: 1 }]} onEvent={onEvent} />);
    expect(onEvent).not.toHaveBeenCalled();
    vi.advanceTimersToNextFrame();
    expect(fired(onEvent)).toEqual(["foot-enter@a"]);
  });
});
