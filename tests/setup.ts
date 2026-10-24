import "@testing-library/jest-dom/vitest";
import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { server } from "./mocks/server";
import { setReducedMotion } from "./helpers/motion";

beforeAll(() => server.listen());
beforeEach(() => {
  setReducedMotion(true);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
