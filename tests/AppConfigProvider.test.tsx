import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppConfigContext } from "../src/providers/AppConfigContext";
import AppConfigProvider from "../src/providers/AppConfigProvider";

const ConfigText = () => {
  const { debug, visionModel } = useContext(AppConfigContext);
  return <p>{`debug: ${debug}, model: ${visionModel}`}</p>;
};

const renderConfig = (url: string, debug?: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppConfigProvider {...(debug === undefined ? {} : { debug })}>
        <ConfigText />
      </AppConfigProvider>
    </MemoryRouter>,
  );

describe("AppConfigProvider", () => {
  it.each([
    ["by default", "/", undefined, "false"],
    ["when the prop turns it on", "/", true, "true"],
    ["when the query turns it on", "/?debug=true", undefined, "true"],
    ["when the query turns it on over a false prop", "/?debug=true", false, "true"],
    ["when the query turns it off over a true prop", "/?debug=false", true, "false"],
  ])("debug is as expected %s", (_name, url, prop, expected) => {
    renderConfig(url, prop);
    expect(screen.getByText(`debug: ${expected}, model: bodypix`)).toBeInTheDocument();
  });

  it("lets the query choose the vision model", () => {
    renderConfig("/?visionModel=movenet");
    expect(screen.getByText("debug: false, model: movenet")).toBeInTheDocument();
  });

  it("ignores query parameters that are not settings", () => {
    renderConfig("/?other=true");
    expect(screen.getByText("debug: false, model: bodypix")).toBeInTheDocument();
  });

  it("keeps the environment's value for a prop that is explicitly undefined", () => {
    render(
      <MemoryRouter>
        <AppConfigProvider debug={undefined}>
          <ConfigText />
        </AppConfigProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("debug: false, model: bodypix")).toBeInTheDocument();
  });

  it("keeps the same config object across re-renders with equal props", () => {
    const seen: unknown[] = [];
    const Capture = () => {
      seen.push(useContext(AppConfigContext));
      return null;
    };
    const { rerender } = render(
      <MemoryRouter>
        <AppConfigProvider debug>
          <Capture />
        </AppConfigProvider>
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <AppConfigProvider debug>
          <Capture />
        </AppConfigProvider>
      </MemoryRouter>,
    );
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
