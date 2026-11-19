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

  it("links to the setup planner and the scene designer under Setup and design", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(screen.getByRole("link", { name: "Scene designer" })).toHaveAttribute("href", "/scene-renderer");
    expect(links.indexOf("Scene designer")).toBe(links.indexOf("Plan your space") + 1);
    const heading = screen.getByRole("heading", { name: "Setup and design" });
    const planLink = screen.getByRole("link", { name: "Plan your space" });
    expect(heading.compareDocumentPosition(planLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
