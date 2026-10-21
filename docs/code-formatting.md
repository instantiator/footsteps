# Code Formatting and Linting Setup

This document outlines the configuration for code formatting (Prettier) and code quality linting (ESLint) in this project. The goal is to ensure consistent code style across the repository and a seamless development experience in Visual Studio Code.

## Required VS Code Extensions

For the editor integration to work as described, you must have the following VS Code extensions installed:

1. **ESLint** (`dbaeumer.vscode-eslint`): Integrates ESLint into VS Code, showing linting errors and warnings directly in the editor.
2. **Prettier - Code formatter** (`prettier.prettier-vscode`): The official Prettier extension, used to format code.

---

## Tool Configuration

Our setup uses three main configuration files to make Prettier and ESLint work together harmoniously.

### 1. Prettier (`.prettierrc.json`)

This file defines our code style rules. It is the single source of truth for all formatting options.

**`.prettierrc.json`:**

```json
{
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false
}
```

- `"printWidth": 120`: Sets the maximum line length to 120 characters.
- `"tabWidth": 2`: Sets the indentation width to 2 spaces.
- `"useTabs": false`: Ensures that spaces are used for indentation, not tabs.

### 2. ESLint (`eslint.config.js`)

ESLint checks code quality, with Prettier wired in so formatting problems show up as lint warnings. In order, the config:

- ignores `dist/`, the `dev-qual/` submodule, React Router's generated `.react-router/` types, and the generated documentation (`docs/tsdoc/`, `docs-static/`, and VitePress's cache);
- applies the recommended rules from `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` to `.ts`/`.tsx` files;
- turns off `@typescript-eslint/indent`, which conflicts with Prettier (see Problem 1 below);
- adds `eslint-plugin-prettier/recommended`, which disables ESLint's stylistic rules and reports Prettier differences as `prettier/prettier` warnings;
- spreads **dev-qual's baseline last**, so nothing can weaken it: no `any`, strict equality, no empty `catch`, and limits on complexity (10), nesting depth (4), parameters (4), and function length (60 lines, except in tests).

`npm run lint:check` and the pre-commit hook run with `--max-warnings 0`, so a warning (including a formatting one) fails the gate.

### 3. VS Code Workspace Settings (`.vscode/settings.json`)

`.vscode/` is gitignored, so these settings aren't in the repository: add them to your own `.vscode/settings.json` to format on save.

**`.vscode/settings.json`:**

```json
{
  "workbench.colorCustomizations": {
    // ... existing color settings ...
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "prettier.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[markdown]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "prettier.prettier-vscode"
  }
}
```

- **TypeScript/TSX Files:** For these files, two actions run on save in sequence:
  1. `"editor.formatOnSave": true` runs first, using Prettier (`prettier.prettier-vscode`) to format the entire file.
  2. `"editor.codeActionsOnSave"` runs immediately after, triggering ESLint to fix any remaining auto-fixable code quality issues.
- **Markdown Files:** We handle Markdown separately to avoid ESLint trying to parse it as code. The `"[markdown]"` block configures VS Code to use only the Prettier extension to format `.md` files on save.

---

## Troubleshooting Journey: Issues and Resolutions

Setting this up involved solving a few tricky problems.

### Problem 1: Formatting "Bouncing" on Save

- **Issue:** When saving a TypeScript file, the indentation would quickly change to 2 spaces (correct) and then immediately "bounce" back to 4 spaces (incorrect), especially for multi-line imports.
- **Diagnosis:** This indicated that two formatters were running in sequence. A diagnostic test confirmed that the Prettier extension alone worked correctly, meaning the conflict was coming from the ESLint "fix on save" action.
- **Resolution:** The root cause was an indentation rule from `@typescript-eslint` that was not being properly disabled by the Prettier configuration for import statements. We resolved this by explicitly disabling the rule in `eslint.config.js`:

  ```javascript
  "rules": {
    "@typescript-eslint/indent": "off"
  }
  ```

### Problem 2: Linting Errors in Markdown Files

- **Issue:** When we initially tried to format Markdown files by including them in `eslint.config.js`, ESLint threw parsing errors because it was attempting to lint Markdown content as if it were JavaScript.
- **Resolution:** We separated the concerns. We removed Markdown from ESLint's scope and configured VS Code to handle it independently. The `"[markdown]"` block in `.vscode/settings.json` tells the editor to use the Prettier extension directly for formatting `.md` files, bypassing ESLint entirely for this file type.

### Problem 3: Initial ESLint and Prettier Conflict

- **Issue:** At the start, ESLint and Prettier were not configured to work together, which would have led to them "fighting" over code style.
- **Resolution:** We installed `eslint-plugin-prettier` and `eslint-config-prettier` and added `eslint-plugin-prettier/recommended` to the ESLint configuration. This makes Prettier the single source of truth for formatting and integrates it smoothly into the ESLint workflow.

---

## How to Modify the Configuration

- **To change a formatting rule (e.g., line width, quotes):** Modify the `.prettierrc.json` file. This is the single source of truth for all style options.
- **To change an ESLint code-quality rule:** Modify the `rules` object in `eslint.config.js`, before the dev-qual baseline. Rules the baseline sets can't be loosened there; change them in dev-qual, or add a targeted `eslint-disable-next-line` with the reason.
