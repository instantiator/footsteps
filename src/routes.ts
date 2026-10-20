import { type RouteConfig, index, route } from "@react-router/dev/routes";

/** The route config: the landing page, a game by id, and that game's JSON debug view. */
export default [
  index("Home.tsx"),
  route("game/:id", "pages/LocalGame.tsx"),
  route("game/:id/json", "pages/LocalGameJson.tsx"),
] satisfies RouteConfig;
