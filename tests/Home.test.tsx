import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import Home from "../src/Home";

describe("Home", () => {
  it("renders the main heading", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const heading = screen.getByRole("heading", { level: 1, name: /Footsteps/i });
    expect(heading).toBeInTheDocument();
  });

  it("links to the scene designer, after the setup planner", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(screen.getByRole("link", { name: "Scene designer" })).toHaveAttribute("href", "/scene-renderer");
    expect(links.indexOf("Scene designer")).toBe(links.indexOf("Plan your space") + 1);
  });

  it("links to the setup planner", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Plan your space" })).toHaveAttribute("href", "/setup");
  });
});
