import { type RouteConfig, index, route } from "@react-router/dev/routes";

/** The route config: the landing page, a game's landing page, the game itself, and its JSON debug view. */
export default [
  index("Home.tsx"),
  route("game/:id", "pages/LocalGameLanding.tsx"),
  route("game/:id/play", "pages/LocalGame.tsx"),
  route("game/:id/json", "pages/LocalGameJson.tsx"),
] satisfies RouteConfig;
