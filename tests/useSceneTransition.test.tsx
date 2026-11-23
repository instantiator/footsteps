import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useSceneTransition from "../src/components/core/layout/useSceneTransition";

/** The hook's options for a scene, with the given layers and key. */
const options = (layers: string, sceneKey = "scene-a") => ({
  layers,
  sceneKey,
  camera: { enabled: false, preview: false },
  sceneMode: "2D" as const,
  shape: "fill" as const,
  reducedMotion: false,
  measureViewport: () => 1.5,
  measureContainer: () => 1.5,
});

describe("useSceneTransition", () => {
  it("renders a content update within the shown scene in the same render, not a commit later", () => {
    // Each render's [asked for, shown]: effects run within the test's act, so a lag only shows render by render
    const renders: [string, string][] = [];
    const { rerender } = renderHook(
      (props: ReturnType<typeof options>) => {
        const shown = useSceneTransition(props);
        renders.push([props.layers, shown.layers]);
        return shown;
      },
      { initialProps: options("first") },
    );
    rerender(options("second"));
    expect(renders.filter(([asked]) => asked === "second").map(([, shown]) => shown)).not.toContain("first");
  });

  it("keeps showing the old scene while a change of scene fades, rather than passing it straight through", () => {
    const { result, rerender } = renderHook((props: ReturnType<typeof options>) => useSceneTransition(props), {
      initialProps: options("first"),
    });
    rerender(options("other", "scene-b"));
    expect(result.current.layers).toBe("first");
  });
});
