import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { FeatureFlagsContext } from "../src/providers/FeatureFlagsContext";
import FeatureFlagsProvider from "../src/providers/FeatureFlagsProvider";

const DebugFlag = () => <p>{`debug: ${useContext(FeatureFlagsContext).debug}`}</p>;

const renderFlags = (url: string, debug?: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FeatureFlagsProvider {...(debug === undefined ? {} : { debug })}>
        <DebugFlag />
      </FeatureFlagsProvider>
    </MemoryRouter>,
  );

describe("FeatureFlagsProvider", () => {
  it.each([
    ["by default", "/", undefined, "false"],
    ["when the prop turns it on", "/", true, "true"],
    ["when the query turns it on", "/?debug=true", undefined, "true"],
    ["when the query turns it on over a false prop", "/?debug=true", false, "true"],
    ["when the query turns it off over a true prop", "/?debug=false", true, "false"],
  ])("debug is as expected %s", (_name, url, prop, expected) => {
    renderFlags(url, prop);
    expect(screen.getByText(`debug: ${expected}`)).toBeInTheDocument();
  });

  it("ignores query parameters that are not flags", () => {
    renderFlags("/?other=true");
    expect(screen.getByText("debug: false")).toBeInTheDocument();
  });

  it("keeps the default for a flag prop that is explicitly undefined", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider debug={undefined}>
          <DebugFlag />
        </FeatureFlagsProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("debug: false")).toBeInTheDocument();
  });
});
