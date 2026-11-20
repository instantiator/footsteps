import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import Tabs from "../src/components/landing/Tabs";

/** Shows the current hash, so tests can see where the tabs put it. */
function Hash() {
  return <output>{useLocation().hash}</output>;
}

const renderTabs = (url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Tabs
        tabs={[
          { id: "one", label: "One", content: <p>First</p> },
          { id: "two", label: "Two", content: <p>Second</p> },
          { id: "three", label: "Three", content: <p>Third</p> },
        ]}
      />
      <Hash />
    </MemoryRouter>,
  );

const tab = (name: string) => screen.getByRole("tab", { name });

describe("Tabs", () => {
  it("opens on the first tab, with only it in the Tab order", () => {
    renderTabs();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("One");
    expect(screen.getAllByRole("tab").map((button) => button.tabIndex)).toEqual([0, -1, -1]);
  });

  it("opens on the tab the hash names, and on the first for a hash it doesn't know", () => {
    const { unmount } = renderTabs("/#three");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Third");
    unmount();
    renderTabs("/#nowhere");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First");
  });

  it("chooses a tab on a click, and puts it in the hash", () => {
    renderTabs();
    fireEvent.click(tab("Two"));
    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second");
    expect(screen.getByRole("status")).toHaveTextContent("#two");
  });

  it("moves the choice and the focus with the arrow keys, Home and End, wrapping round", () => {
    renderTabs();
    fireEvent.keyDown(tab("One"), { key: "ArrowLeft" });
    expect(tab("Three")).toHaveFocus();
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
    expect(tab("One")).toHaveFocus();
    fireEvent.keyDown(tab("One"), { key: "End" });
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab("Three"), { key: "Home" });
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });
});
