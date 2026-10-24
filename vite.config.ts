import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.BASE_URL ?? "/",
  // The React Router plugin builds the app; vitest compiles JSX itself and must not load it
  plugins: [!process.env.VITEST && reactRouter()],
  // The vision worker is a module worker that loads MediaPipe's runtime with a dynamic import
  worker: { format: "es" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
    // In GitHub Actions: annotate failures and write a job summary, plus a JUnit file for the run's artefacts
    ...(process.env.GITHUB_ACTIONS === "true" && {
      reporters: ["default", "github-actions", "junit"],
      outputFile: { junit: "test-results/junit.xml" },
    }),
  },
});
