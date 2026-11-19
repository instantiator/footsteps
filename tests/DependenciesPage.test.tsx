import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import licenses from "../src/assets/license-report.json";
import DependenciesPage from "../src/pages/DependenciesPage";

describe("DependenciesPage", () => {
  it("lists every dependency with its licence, with a way back", () => {
    render(
      <MemoryRouter>
        <DependenciesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Dependencies" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(licenses.length);
    expect(screen.getByRole("link", { name: "Back to games" })).toHaveAttribute("href", "/");
  });
});
