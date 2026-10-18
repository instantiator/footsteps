import type { RouteObject } from "react-router-dom";
import Home from "./Home";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/game/:id",
    lazy: () => import("./pages/LocalGame"),
  },
  {
    path: "/game/:id/json",
    lazy: () => import("./pages/LocalGameJson"),
  },
];

export default routes;
