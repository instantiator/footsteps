import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.BASE_URL ?? "/",
  // The React Router plugin builds the app; vitest compiles JSX itself and must not load it
  plugins: [!process.env.VITEST && reactRouter()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
