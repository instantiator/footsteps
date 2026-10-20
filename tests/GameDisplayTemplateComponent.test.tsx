import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import GameDisplayTemplateComponent from "../src/components/core/display/GameDisplayTemplateComponent";
import type { GameDisplayTemplateSourceData } from "../src/entities/data/displays/GameDisplayTemplateComponentData";
import type { GameSource } from "../src/entities/GameSource";
import GameContentCacheProvider from "../src/providers/GameContentCacheProvider";
import { GameRepositoryContext } from "../src/providers/GameRepositoryContext";
import { LOADING_REPOSITORY } from "../src/entities/GameRepository";
import { getBaseURL } from "../src/util/ObjectUtils";

const localSource: GameSource = { type: "LocalRepository", path: "game-repository.json" };

/** Gives the component the content cache and repository source it needs to fetch templates. */
const Wrapper = ({ children }: { children: ReactNode }) => (
  <GameRepositoryContext.Provider value={{ source: localSource, repository: LOADING_REPOSITORY }}>
    <GameContentCacheProvider>{children}</GameContentCacheProvider>
  </GameRepositoryContext.Provider>
);

const embedded = (content: string): GameDisplayTemplateSourceData => ({ sourceType: "embedded", content });

describe("GameDisplayTemplateComponent", () => {
  it("renders an embedded template with the template data", async () => {
    render(
      <GameDisplayTemplateComponent
        templateSource={embedded('<p id="x">Hello {{name}}</p>')}
        templateData={{ name: "Nanny" }}
      />,
      { wrapper: Wrapper },
    );
    expect(await screen.findByText("Hello Nanny")).toBeInTheDocument();
  });

  // BUG #17 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): data HTML should be inserted unescaped in the template body (docs/game-data.md); actual: MustacheTemplate renders with its own default-escaping Mustache, so MUSTACHE_OPTIONS only affects container styles
  it.skip("does not escape HTML in the data, so data can contribute markup", async () => {
    const { container } = render(
      <GameDisplayTemplateComponent
        templateSource={embedded("<div>{{markup}}</div>")}
        templateData={{ markup: "<b id='bold'>hi</b>" }}
      />,
      { wrapper: Wrapper },
    );
    expect(await screen.findByText("hi")).toBeInTheDocument();
    expect(container.querySelector("b#bold")).not.toBeNull();
  });

  it("fetches a url template", async () => {
    const url = new URL("games/magic-trifle/title/foreground.mustache", getBaseURL()).toString();
    const { container } = render(
      <GameDisplayTemplateComponent
        templateSource={{ sourceType: "url", templateSource: url }}
        templateData={{ resources: { "title-foreground": "title.png" } }}
      />,
      { wrapper: Wrapper },
    );
    expect(await screen.findByRole("img", { hidden: true })).toHaveAttribute("src", "title.png");
    expect(container.querySelector("#magic-trifle-title")).not.toBeNull();
  });

  it("fetches a local template from the site, for a local repository", async () => {
    render(
      <GameDisplayTemplateComponent
        templateSource={{ sourceType: "local", templateSource: "games/magic-trifle/title/foreground.mustache" }}
        templateData={{ resources: { "title-foreground": "local.png" } }}
      />,
      { wrapper: Wrapper },
    );
    expect(await screen.findByRole("img", { hidden: true })).toHaveAttribute("src", "local.png");
  });

  it("renders string container style values as Mustache templates over the data", async () => {
    const { container } = render(
      <GameDisplayTemplateComponent
        templateSource={embedded("<p>x</p>")}
        templateData={{ resources: { bg: "bg.png" }, colour: "red" }}
        containerStyle={{ backgroundImage: "url('{{resources.bg}}')", color: "{{colour}}" }}
      />,
      { wrapper: Wrapper },
    );
    await screen.findByText("x");
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundImage).toBe('url("bg.png")');
    expect(root.style.color).toBe("red");
  });

  it("renders children after the template", async () => {
    render(
      <GameDisplayTemplateComponent templateSource={embedded("<p>template</p>")} templateData={{}}>
        <span>child</span>
      </GameDisplayTemplateComponent>,
      { wrapper: Wrapper },
    );
    const template = await screen.findByText("template");
    const child = screen.getByText("child");
    expect(template.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // BUG #1 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): numeric style values such as zIndex: 2 should apply; actual: Mustache.render throws on a non-string
  it.skip("applies numeric container style values", async () => {
    const { container } = render(
      <GameDisplayTemplateComponent
        templateSource={embedded("<p>x</p>")}
        templateData={{}}
        containerStyle={{ zIndex: 2 }}
      />,
      { wrapper: Wrapper },
    );
    await screen.findByText("x");
    expect((container.firstElementChild as HTMLElement).style.zIndex).toBe("2");
  });

  // BUG #2 (docs/prompts/000.00.02.feedback - fixes from identified bugs and tests.md): template style values should be Mustache-rendered like container styles; actual: {{...}} reaches the DOM literally
  it.skip("renders template style values as Mustache templates over the data", async () => {
    render(
      <GameDisplayTemplateComponent
        templateSource={embedded("<p>x</p>")}
        templateData={{ font: "Courier" }}
        templateStyle={{ fontFamily: "{{font}}" }}
      />,
      { wrapper: Wrapper },
    );
    const wrapper = (await screen.findByText("x")).parentElement as HTMLElement;
    expect(wrapper.style.fontFamily).toBe("Courier");
  });
});
