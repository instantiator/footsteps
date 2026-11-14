import "@testing-library/jest-dom/vitest";
import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { server } from "./mocks/server";
import { setReducedMotion } from "./helpers/motion";

beforeAll(() => server.listen());
beforeEach(() => {
  setReducedMotion(true);
  localStorage.clear();
  sessionStorage.clear();
  // Forgets where the pointer was, so a scene in one test doesn't enter what a pointer in another rested on
  window.dispatchEvent(new MouseEvent("pointerout", { relatedTarget: null }));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
