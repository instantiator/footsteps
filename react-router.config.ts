import type { Config } from "@react-router/dev/config";
import localRepository from "./public/game-repository.json";

/** Static build for GitHub Pages: no server, every known route prerendered to HTML. */
export default {
  appDirectory: "src",
  buildDirectory: "dist",
  ssr: false,
  basename: process.env.BASE_URL ?? "/",
  prerender: ["/", ...Object.keys(localRepository.games).flatMap((id) => [`/game/${id}`, `/game/${id}/json`])],
} satisfies Config;
