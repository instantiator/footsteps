import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

/** Docs are served at `<base>docs/`, so asset URLs survive the GitHub Pages base path. */
const base = `${process.env.BASE_URL ?? "/"}docs/`.replace(/\/{2,}/g, "/");

/** Prompt and plan files, listed so new ones appear in the sidebar without config edits. */
const promptsDir = fileURLToPath(new URL("../prompts", import.meta.url));
const promptPages = readdirSync(promptsDir)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort()
  .map((name) => ({
    text: name.replace(/\.md$/, ""),
    link: `/prompts/${name.replace(/\.md$/, "")}`,
  }));

/** ADRs, listed so new ones appear in the sidebar without config edits, each titled from its heading. */
const adrsDir = fileURLToPath(new URL("../ADRs", import.meta.url));
const adrPages = readdirSync(adrsDir)
  .filter((name) => /^\d{4}-.*\.md$/.test(name))
  .sort()
  .map((name) => {
    const heading = readFileSync(`${adrsDir}/${name}`, "utf8").match(/^# ADR (\d{4}): (.+)$/m);
    return {
      text: heading ? `${heading[1]} ${heading[2]}` : name.replace(/\.md$/, ""),
      link: `/ADRs/${name.replace(/\.md$/, "")}`,
    };
  });

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-GB",
  title: "Footsteps",
  description: "A puzzle game engine and interface, built with React and TypeScript.",
  base,
  // The TypeDoc HTML is copied in after the build; VitePress never sees it as a page
  srcExclude: ["tsdoc/**"],
  outDir: "../docs-static",
  ignoreDeadLinks: [/^\/tsdoc\//, /^http:\/\/localhost/],
  markdown: {
    config(md) {
      // Handlebars examples sit in inline code: without v-pre, Vue reads {{ … }} as interpolation
      md.renderer.rules.code_inline = (tokens, idx) => `<code v-pre>${md.utils.escapeHtml(tokens[idx].content)}</code>`;
    },
  },
  themeConfig: {
    nav: [
      { text: "Guide", link: "/" },
      // TypeDoc's pages are plain HTML outside VitePress's router, which would otherwise render its 404:
      // `target` makes the browser load them itself (appending index.html is not enough; .html is routed too)
      { text: "API reference", link: "/tsdoc/", target: "_blank" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Documentation", link: "/" },
          { text: "Developer overview", link: "/dev-overview" },
          { text: "Playing a game", link: "/game-play" },
          { text: "Deployment", link: "/deployment" },
          { text: "Game data", link: "/game-data" },
          { text: "Positions, sizes and units", link: "/positions-sizes-units" },
          { text: "Game repository data", link: "/game-repository-data" },
          { text: "Camera mode", link: "/camera-mode" },
          { text: "Known webcams", link: "/webcams" },
          { text: "Code formatting", link: "/code-formatting" },
          { text: "Outstanding issues", link: "/outstanding-issues" },
        ],
      },
      {
        text: "Tutorials",
        items: [
          { text: "Tutorials", link: "/tutorials/" },
          { text: "Your first game", link: "/tutorials/your-first-game" },
          { text: "A scene without a camera", link: "/tutorials/scene-without-camera" },
          { text: "A 2D scene", link: "/tutorials/2d-scene" },
          { text: "A 2.5D scene", link: "/tutorials/2-5d-scene" },
          { text: "Using players' floor positions", link: "/tutorials/floor-positions" },
          { text: "Converting a scene to 2.5D", link: "/tutorials/converting-to-2-5d" },
          { text: "Sample elements", link: "/tutorials/sample-elements" },
        ],
      },
      {
        text: "Decisions",
        items: adrPages,
      },
      {
        text: "Prompts and plans",
        collapsed: true,
        items: [{ text: "About prompts", link: "/prompts/README" }, ...promptPages],
      },
      {
        text: "Reference",
        items: [{ text: "API reference", link: "/tsdoc/", target: "_blank" }],
      },
    ],
    outline: { level: [2, 3], label: "On this page" },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/instantiator/footsteps" }],
    footer: {
      message: "Generated documentation for the Footsteps game engine.",
    },
  },
});
