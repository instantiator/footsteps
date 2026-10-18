import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScrollNavigation } from "../src/components/core/display/GameDisplayScrollComponent";

describe("ScrollNavigation", () => {
  it("offers labelled buttons (so keyboard activation is native) for the pages that exist", () => {
    const onAdvance = vi.fn();
    render(<ScrollNavigation onAdvance={onAdvance} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onAdvance).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(<ScrollNavigation />);
    expect(container).toBeEmptyDOMElement();
  });
});
