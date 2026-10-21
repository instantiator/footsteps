import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import devQualBaseline from "./dev-qual/guidance/languages/typescript/tools/eslint-baseline.mjs";

export default defineConfig([
  globalIgnores(["dist", "dev-qual", ".react-router", "docs/tsdoc", "docs-static", "docs/.vitepress/cache"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/indent": "off", // Explicitly disable indent rule to avoid conflict with Prettier
    },
  },
  eslintPluginPrettierRecommended,
  {
    rules: {
      "prettier/prettier": "warn",
    },
  },
  // dev-qual baseline last, so nothing after it can weaken it
  ...devQualBaseline,
]);
