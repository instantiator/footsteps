import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import Home from "../src/Home";

const renderHome = (url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Home />
    </MemoryRouter>,
  );

describe("Home", () => {
  it("titles the page with the footsteps icon, hidden from screen readers", () => {
    renderHome();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAccessibleName("Footsteps");
    expect(heading).toHaveTextContent("👣 Footsteps");
  });

  it("opens on the local repository's tab, among three", () => {
    renderHome();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Local repository",
      "Setup and design",
      "Attributions",
    ]);
    expect(screen.getByRole("tab", { name: "Local repository" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Status: Loading...");
  });

  it("links to the setup planner and the scene designer under Setup and design", () => {
    renderHome();
    fireEvent.click(screen.getByRole("tab", { name: "Setup and design" }));
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(screen.getByRole("link", { name: "Plan your space" })).toHaveAttribute("href", "/setup");
    expect(screen.getByRole("link", { name: "Scene designer" })).toHaveAttribute("href", "/scene-renderer");
    expect(links.indexOf("Scene designer")).toBe(links.indexOf("Plan your space") + 1);
  });

  it("links to the dependencies' licences first under Attributions", () => {
    renderHome("/#attributions");
    const panel = screen.getByRole("tabpanel");
    expect(panel.firstElementChild).toContainElement(screen.getByRole("link", { name: "Dependencies" }));
    expect(screen.getByRole("link", { name: "Dependencies" })).toHaveAttribute("href", "/dependencies");
  });

  it("says in the footer that it's open source, with links to the licence and the code", () => {
    renderHome();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "Footsteps is an open source product, released under the MIT license. Source code at: instantiator/footsteps.",
    );
    expect(screen.getByRole("link", { name: "MIT license" })).toHaveAttribute(
      "href",
      "https://github.com/instantiator/footsteps/blob/main/LICENSE",
    );
    expect(screen.getByRole("link", { name: "instantiator/footsteps" })).toHaveAttribute(
      "href",
      "https://github.com/instantiator/footsteps",
    );
  });

  it.each([
    ["/", false],
    ["/?debug=true", true],
  ])("shows the base path in the footer only in debug mode, at %s", (url, shown) => {
    renderHome(url);
    expect(screen.getByRole("contentinfo").textContent?.includes("Base path: /")).toBe(shown);
  });
});
