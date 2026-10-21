import { readdirSync } from "node:fs";
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
      { text: "API reference", link: "/tsdoc/" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Documentation", link: "/" },
          { text: "Developer overview", link: "/dev-overview" },
          { text: "Deployment", link: "/deployment" },
          { text: "Game data", link: "/game-data" },
          { text: "Game repository data", link: "/game-repository-data" },
          { text: "Camera mode", link: "/camera-mode" },
          { text: "Code formatting", link: "/code-formatting" },
          { text: "Outstanding issues", link: "/outstanding-issues" },
        ],
      },
      {
        text: "Decisions",
        items: [
          {
            text: "0001 Replace vite-react-ssg with React Router",
            link: "/ADRs/0001-replace-vite-react-ssg-with-react-router-framework-mode",
          },
        ],
      },
      {
        text: "Prompts and plans",
        collapsed: true,
        items: [{ text: "About prompts", link: "/prompts/README" }, ...promptPages],
      },
      {
        text: "Reference",
        items: [{ text: "API reference", link: "/tsdoc/" }],
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
