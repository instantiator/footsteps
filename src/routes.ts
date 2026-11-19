import { type RouteConfig, index, route } from "@react-router/dev/routes";

/**
 * The route config: the landing page, a game's landing page, the game itself, the floor calibration it links to, and
 * its JSON debug view, the scene renderer for game authors, the setup planner for sizing a room's floor, and the
 * dependencies' licences.
 */
export default [
  index("Home.tsx"),
  route("game/:id", "pages/LocalGameLanding.tsx"),
  route("game/:id/play", "pages/LocalGame.tsx"),
  route("game/:id/calibrate", "pages/LocalCalibrate.tsx"),
  route("game/:id/json", "pages/LocalGameJson.tsx"),
  route("scene-renderer", "pages/SceneRenderer.tsx"),
  route("setup", "pages/SetupPlanner.tsx"),
  route("dependencies", "pages/DependenciesPage.tsx"),
] satisfies RouteConfig;
