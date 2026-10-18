/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import localRepository from "./public/game-repository.json";

// https://vitejs.dev/config/
// @ts-expect-error keeping mode here, for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineConfig(({ mode }) => {
  const base = process.env.BASE_URL ?? "/";

  return {
    base,
    plugins: [react()],
    ssgOptions: {
      script: "async",
      formatting: "prettify",
      includedRoutes: async () => {
        const ids = Object.keys(localRepository.games);
        const dynamicRoutes = ids.flatMap((id) => [`/game/${id}`, `/game/${id}/json`]);
        return ["/", ...dynamicRoutes];
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  };
});
