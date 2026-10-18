import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("Home.tsx"),
  route("game/:id", "pages/LocalGame.tsx"),
  route("game/:id/json", "pages/LocalGameJson.tsx"),
] satisfies RouteConfig;
