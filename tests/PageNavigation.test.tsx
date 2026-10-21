import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageNavigation } from "../src/components/core/display/GameDisplayDialogComponent";

describe("PageNavigation", () => {
  it("offers labelled buttons (so keyboard activation is native) for the pages that exist", () => {
    const onAdvance = vi.fn();
    render(<PageNavigation onAdvance={onAdvance} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onAdvance).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(<PageNavigation />);
    expect(container).toBeEmptyDOMElement();
  });
});
