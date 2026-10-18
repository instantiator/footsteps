---
status: active
---

# Plan: dev-qual onboarding — flatten layout, update deps, clear the quality gate

- **Branch:** `chore/dev-qual-onboarding` (from `main`)
- **Commits:** one per stage, once its gate passes. Stage 1's commit includes the already-staged dev-qual install.
- **Orchestrator:** Opus. Mechanical stages (1, 2, 4) can go to a Sonnet sub-agent. The dependency majors and the refactors (5–8) stay with Opus, because they need judgement.
- On approval, copy this file to `docs/plans/2026-10-18-dev-qual-onboarding.md` (after Stage 2 creates the root `docs/`) and list it in `docs/index.md`, so `plan-status.sh` and the Stop hook can track it.

## Context

dev-qual has been installed: a submodule, hooks in `.claude/settings.json`, and git hooks via `core.hooksPath`. The pre-commit hook runs `check.sh --fast`, and that currently **fails**, so nothing can be committed.

What I ran and found:

- **Root `check.sh`:** markdownlint FAILs with 18 errors (AGENTS.md MD012; footsteps/docs/code-formatting.md MD030×6 and MD031; dev-overview.md MD034×4 and MD014×2; GEMINI.md MD034×4). Every node stage is SKIPped: `detect_stacks` (`dev-qual/scripts/lib/common.sh:22`) only looks for a `package.json` at the root, so the app is never linted, typechecked, built or tested.
- **`check.sh` on a scratch copy of `footsteps/` (simulating the move):** lint, typecheck, build and unit-tests PASS. markdownlint FAILs. aislop FAILs on:
  - 39 vulns (1 critical, 27 high)
  - 14 console.logs
  - 13 `react/set-state-in-effect`
  - about 14 jsx-a11y findings (click without key events, static-element interactions, media captions)
  - 2 complexity findings (`GameStateUtils.ts:99 completeChallenge` at 92 lines, and `GameDataProvider.tsx:18` at nesting depth 6)
  - 4 trivial comments, 2 `@ts-ignore`, 1 TODO
- **eslint baseline** (`dev-qual/guidance/languages/typescript/tools/eslint-baseline.mjs`) isn't adopted. Adopting it adds 22 errors:
  - 6 `no-explicit-any`, in GameDisplayScrollComponent, GameDisplayTemplateComponent, RenderDataUtils, AudioUtils, Dependencies and GameDataProvider
  - 9 `max-lines-per-function`, in CharacterCanvas, Game, GameDisplayScrollComponent, GameTextInputComponent, GameLayersLayout, GameStateUtils and others
  - 4 `complexity`, in CameraSupport, GameDisplayScrollComponent, GameLayersLayout and GameContentCacheHook
  - 2 `max-depth`, in GameClickUtils
  - 1 `max-params`, in BodySegSupport
- **Existing config breaks the rules:** `footsteps/eslint.config.js` turns off `no-explicit-any` (AGENTS.md rule 4) and `react-hooks/set-state-in-effect`, and downgrades `no-unused-vars` to warn. `"test": "vitest"` runs in watch mode, so `check.sh` would hang outside CI.
- **Deps:** 31 outdated packages. Majors are available for MUI 9, react-router-dom 7, vite 8, vitest 5, eslint 10 (+@eslint/js, globals 17), TypeScript 7, jsdom 30, msw 3, uuid 14, @vitejs/plugin-react 6, unplugin-fonts 2, vite-react-ssg 0.9, @testing-library/jest-dom 7, @types/node 26 and eslint-plugin-react-refresh 0.5. Most vulns clear with in-range updates. `unplugin-fonts` needs v2 (fast-glob/braces). For `@tensorflow/tfjs` (argparse/sprintf-js), npm's only "fix" is a downgrade, so that needs an `overrides` entry or an accepted-risk record.
- **CI** (`.github/workflows/deploy-pages.yaml`) uses Node 22 and pinned @v3/@v4 actions. It builds `./footsteps` but never runs tests.

Intended outcome: the app sits at the repo root, `check.sh --comprehensive` passes clean, dependencies are at latest (or deferred with a condition), and the branch can be pushed.

### Decisions taken

| Decision         | Choice                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout           | Move `footsteps/*` to the repo root with `git mv` (keeps history)                                                                                           |
| Dependency scope | All majors. In-range updates and audit fixes first, then one major (or coupled group) per stage. A major blocked by peer deps is deferred with a condition. |
| Strictness       | Adopt the full eslint baseline, fix all 22 errors, re-enable `no-explicit-any`, and clear every aislop finding                                              |
| Branch / commits | New branch, one commit per stage                                                                                                                            |

### Constraints and reuse

- AGENTS.md rules: no `any` (including test mocks), zero warnings, comments state intent, and only change what this plan covers.
- Targeted `eslint-disable` only where genuinely unavoidable, with the reason inline (`dev-qual/guidance/languages/typescript/typescript.md`).
- Reuse `src/providers/FeatureFlagsProvider.tsx` / `FeatureFlagsHook.tsx` to gate diagnostic logging, rather than adding a logger library.
- Reuse the existing scripts: `pre-build.sh`, `run-tests.sh`, `validate-repository.sh`, `generate-license-report.sh`.
- Skills: `deps-audit` (Stages 3–5), `quality-review` (Stages 6–8), `docs-review` (Stage 9).
- Never use `--no-verify`. The pre-commit hook is the gate.
- `npm ci` warns that npm 11 `allow-scripts` blocks install scripts (esbuild, msw, core-js, fsevents). The build still passes. Approve esbuild and msw in Stage 3 so this stays warning-free.

### Git hook interaction (no `--no-verify` needed)

- **pre-commit** runs `check.sh --fast` on the staged snapshot: format:check, lint:check, typecheck, shellcheck, actionlint and markdownlint. Baseline non-adoption is a SKIP, not a FAIL. Build, tests and aislop are **not** in pre-commit. Each stage below is ordered and split so its commit passes this:
  - Stage 1 passes once the markdown is fixed.
  - Stage 2 must run `npm ci` before committing (the hook symlinks the root `node_modules` into the snapshot). It also adds a `.prettierignore` (`dev-qual/`, `dist/`, `public/games/`, `src/assets/license-report.json`, `package-lock.json`) so the new `format:check` doesn't fail on vendored or generated files. Anything prettier still flags gets formatted in the same commit.
  - Stage 6/7: the baseline config lands with the refactor that satisfies it (see Stage 6). Stage 8 re-enables `set-state-in-effect` in the same commit as its fixes.
- **pre-push** runs the full `check.sh`, including build, tests and **aislop**. aislop fails until Stage 8 (vulns until Stage 5), so the branch couldn't be pushed mid-plan. Fix: Stage 2 adds `.aislop/config.yml` with `ci.baseline: .aislop/ci-baseline.json` (written by `aislop baseline write`). `aislop ci` fails on any error-level finding unless a baseline is set; with one, it fails only on findings not already recorded. So pushing is possible after any stage, with no bypass. Each clean-up stage ends with `npx aislop@latest baseline prune` and raises `ci.failBelow` to the new score.
- **Fallback:** if a stage still can't pass the hook (e.g. a major upgrade whose fallout needs splitting), split the stage further, or ask the user before any `--no-verify`. Never use it silently.

## Stages

- [x] Stage 1: Fix markdownlint and commit the dev-qual install
- [x] Stage 2: Move footsteps to the repo root and wire up npm scripts
- [x] Stage 3: In-range updates and audit fixes
- [x] Stage 4: CI workflow update
- [x] Stage 5: Major dependency upgrades (sub-stages 5a–5h; router and fonts decisions recorded)
- [ ] Stage 6: Adopt eslint baseline; remove `any`
- [ ] Stage 7: Refactor for baseline limits (length, complexity, depth, params)
- [ ] Stage 8: Clear aislop findings
- [ ] Stage 9: Documentation and wrap-up

### Stage 1: Fix markdownlint and commit the dev-qual install (Sonnet)

**Brief:** Fix the 18 markdownlint errors listed in Context:

- MD034: wrap bare URLs in `<…>`.
- MD014: drop the `$` prompts.
- MD030: use one space after list markers.
- MD031: add blank lines around fences.

The AGENTS.md MD012 error is the double blank line before `<!-- dev-qual:skills:start -->`. Remove it there, and check whether `dev-qual/install.sh` would regenerate it. If it would, record it in `docs/outstanding-issues.md` as an upstream issue. Then `git switch -c chore/dev-qual-onboarding` and commit the staged dev-qual files together with the markdown fixes.

**Tests:** none (docs only).

**Gate:** `dev-qual/scripts/check.sh --fast` shows markdownlint PASS, and the commit succeeds through the pre-commit hook.

### Stage 2: Move footsteps to the repo root and wire up npm scripts (Sonnet)

**Brief:**

1. `git mv` every tracked file under `footsteps/` to the root, `footsteps/docs/` → `docs/`.
2. Merge `footsteps/.gitignore` into the root `.gitignore` (the root keeps `.vscode`, since footsteps' `!.vscode/extensions.json` doesn't apply there).
3. Fold the root `README.md` (title and GitHub Pages note) into the moved `README.md`.
4. Update the `footsteps/` path references in `docs/code-formatting.md`, `docs/dev-overview.md` and `GEMINI.md`.
5. Update `.github/workflows/deploy-pages.yaml`: drop `working-directory`, use `cache-dependency-path: package-lock.json` and `path: ./dist`.
6. Add the npm scripts dev-qual expects:
   - `"typecheck": "tsc -b --noEmit"`. Check that this works with project references; otherwise use `tsc -b` with an explicit tsconfig.
   - `"lint:check": "eslint . --max-warnings 0"`
   - `"format": "prettier --write ."`
   - `"format:check": "prettier --check ."`
   - `"test": "vitest run"`, which removes the watch-mode hang
7. In `run-tests.sh`, change `npx --yes vitest run` to `npx --no-install vitest run`.
8. Add `docs/index.md` listing the docs, and copy this plan into `docs/plans/`.
9. Add `.prettierignore` and `.aislop/config.yml` (threshold set to the current score), per "Git hook interaction" above.
10. Run `npm ci` before committing.

**Tests:** none new. The existing 4 suites must still pass.

**Gate:** `dev-qual/scripts/check.sh` is all PASS, with the stacks line showing `node`. aislop passes via the ratchet threshold. `npm run dev` serves `/game/test-game`. From this stage on, every stage ends by raising the aislop threshold to its new score.

### Stage 3: In-range updates and audit fixes (Opus, `deps-audit` skill)

**Brief:**

- `npm update`, then `npm audit fix` (never `--force`). Re-run `npm audit`.
- Add `overrides` in `package.json` for transitive vulns that are still open, if a patched version exists in range. Likely candidates: `sprintf-js`/`argparse` under tfjs.
- Anything left unfixable goes in `docs/outstanding-issues.md` with its condition. An example is "@tensorflow/tfjs publishes a release without argparse <x>", plus a note on whether it reaches the browser bundle (it's in the CLI tooling path, not the runtime).
- Approve install scripts for esbuild and msw (`npm install-scripts approve`).
- Commit the regenerated `src/assets/license-report.json` along with the lockfile.

**Tests:** existing suites.

**Gate:** `check.sh` node stages PASS. `npm audit --audit-level=high` is clean, except for packages fixed by majors in Stage 5 (expected: unplugin-fonts/fast-glob, react-router 6.x if 6.30.6 doesn't clear it). `npm run build` passes.

### Stage 4: CI workflow update (Sonnet)

**Brief:** In `deploy-pages.yaml`:

- Move to Node 24 (current LTS) and add `engines.node` to `package.json` to match.
- Bump each action to its latest major. Confirm versions with `gh api repos/actions/<name>/releases/latest`.
- Add `npm test` before the build so deploys are gated on tests.

Adding a separate PR check workflow is out of scope. Record it in outstanding-issues ("when the repo takes PRs from others").

**Gate:** `actionlint` PASS in `check.sh`.

### Stage 5: Major dependency upgrades (Opus)

One commit per sub-stage. Each one: read the upstream migration guide, bump, fix the fallout, and run the gate. If a major is blocked by a peer range (check `npm view <pkg> peerDependencies`), defer it to outstanding-issues with the condition "<blocking pkg> supports <version>", then move on.

Re-ordered after two findings, both decided with the user (2026-10-18):

- vite-react-ssg 0.9.2 (latest) still peers on `react-router-dom` v6, and react-router's advisories need v7.18+. **Decision:** drop vite-react-ssg and use React Router's framework mode with `prerender` (now `react-router` v8.4; `react-router-dom` stopped at 7.x).
- unplugin-fonts (1.x and 2.0) depends on fast-glob → braces, a high-severity advisory with no fixed release. **Decision:** replace it with Google Fonts `<link>` tags.

Sub-stages:

- 5a: **Fonts.** Remove unplugin-fonts and the `unfonts.css` import, and put a preconnect plus Google Fonts `<link>` for Crimson Pro, Open Sans, Material Icons and DynaPuff in the HTML head.
- 5b: **React Router 8 framework mode, dropping vite-react-ssg.** Record an ADR (`adr` skill) first. Add `react-router.config.ts` (`ssr: false`, `prerender` from `public/game-repository.json` ids, `basename` from `BASE_URL`), a root route with the HTML shell, and a route config. The pages become default-export route modules. Swap `react-router-dom` imports to `react-router`. Replace `@vitejs/plugin-react` with the `reactRouter()` plugin, skipping it under vitest. Update the scripts (`react-router dev`/`build`) and the deploy artifact path. Keep the `/game/:id` and `/game/:id/json` URLs.
- 5c: **vite 8** (plus `@vitejs/plugin-react` 6, if it's still needed after 5b).
- 5d: **vitest 5, jsdom 30, @testing-library/jest-dom 7, msw 3.** Update `tests/setup.ts`, `tests/mocks/*`, and `tsconfig.vitest.json` types.
- 5e: **eslint 10, @eslint/js 10, globals 17, eslint-plugin-react-refresh 0.5.** Check that `typescript-eslint` and `eslint-plugin-react-hooks` support eslint 10 first.
- 5f: **TypeScript 7.** Check typescript-eslint's peer range, and defer if blocked.
- 5g: **MUI 9** (`@mui/material`, `@mui/icons-material`), via the migration guide and codemods.
- 5h: **uuid 14.**
- `@types/node` stays on 24.x to match the Node 24 LTS runtime (decided in Stage 4).

**Tests:** existing suites, plus build. For 5b, `tests/Home.test.tsx` moves to `react-router`'s `MemoryRouter`.

**Gate per sub-stage:** `check.sh --fast`, `npm test` and `npm run build` all pass. For 5a, 5b, 5c and 5g, also smoke-test the dev server and the built output: `/`, `/game/test-game` and `/game/magic-trifle` load, and the prerendered HTML exists for each route. The end of Stage 5 must also pass `npm outdated` (only deferred items) and `npm audit` (clean, or recorded).

### Stage 6: Adopt eslint baseline; remove `any` (Opus)

**Brief:**

- Rename `eslint.config.js` to `eslint.config.mjs` only if the baseline header requires it (it doesn't; `"type": "module"` covers it). Spread `dev-qual/guidance/languages/typescript/tools/eslint-baseline.mjs` **last**, using the relative path `./dev-qual/...`.
- Delete the `no-explicit-any: off` and `no-unused-vars: warn` overrides.
- Keep `set-state-in-effect: off` until Stage 8.
- Replace the 6 `any`s with real types. Use `unknown` plus a narrowing guard at JSON boundaries (`RenderDataUtils`, `GameDataProvider`), and the package's own types for `Dependencies.tsx` (license-report JSON → typed interface) and `AudioUtils`.
- Resolve the 2 `@ts-ignore`s (`GameClickUtils.ts:11`, `vite.config.ts:9`): fix the types, or use `@ts-expect-error` with a reason.

**Tests:** none. As built, every fix was type-only (`catch (err)` as `unknown`, inferred JSON import types, `GameTemplateData`/`object` for Mustache views), with no runtime guard to test. The `@ts-expect-error` in `GameClickUtils.ts` hid an unused `layerId` parameter, which was removed rather than kept "for future use".

**Gate:** `no-explicit-any` has 0 hits, and `check.sh --fast` plus `npm test` pass. Stage 6 commits the `any`/`@ts-ignore` fixes and the new test only. The baseline config change is made here but committed with Stage 7, because the remaining 16 baseline errors would otherwise block the pre-commit hook.

### Stage 7: Refactor for baseline limits (Opus)

**Brief:** Fix the 16 length, complexity, depth and params errors by extracting cohesive pieces: sub-components for the JSX-heavy components (Game, GameLayersLayout, GameDisplayScrollComponent, GameTextInputComponent, CharacterCanvas), and pure helpers for logic (`GameStateUtils.completeChallenge`, `GameClickUtils`, `CameraSupport`, `GameContentCacheHook`). For `BodySegSupport`'s 5 params, use an options object. Use early returns for depth (this also fixes aislop's `GameDataProvider` depth-6 finding). No behaviour changes.

**Tests:** before refactoring each logic file, add characterisation tests:

- `tests/GameStateUtils.test.tsx`: `completeChallenge` cases for the last challenge in a stage, a mid-stage challenge, an already-completed challenge, and the next-stage recommendation.
- `tests/GameClickUtils.test.ts`: hit and miss paths.
- `CameraSupport` and `GameContentCacheHook` extracted helpers: one test file each, covering the branches that drove the complexity score.

**Gate:** `check.sh --fast` (lint 0 errors, 0 warnings, baseline PASS), `npm test` and `npm run build` all pass. Smoke-test both games in `npm run dev`.

### Stage 8: Clear aislop findings (Opus)

**Brief:**

- **console.log (14):** delete the debug leftovers, and route genuine diagnostics through a debug feature flag via `FeatureFlagsHook`. Keep `console.error`/`console.warn` for real errors.
- **set-state-in-effect (13):** re-enable the rule. Fix each case by deriving the value during render, using `useMemo`, keying a component to reset state, or moving the update into the event handler. If a case really is syncing to an external system, use a targeted disable with the reason.
- **a11y:** clickable `div`s become `<button>` (or get `role`, `tabIndex` and `onKeyDown` where a button breaks the layout). For audio `media-has-caption`, background music/SFX has no speech, so use a targeted disable with that reason. Check the "missing alt" finding at `GameAudioComponent.tsx:27` and fix it if real.
- Remove the 4 trivial comments, and resolve or record the TODO at `CharacterCanvas.tsx:105`.

**Tests:** for any component converted to `<button>`, add one RTL test that keyboard activation (Enter) triggers the same handler as a click (e.g. `tests/GameChallengeGrid.test.tsx`).

**Gate:** `dev-qual/scripts/check.sh` (full) is all PASS, including aislop. Smoke-test both games, including the camera overlay if a webcam is available.

### Stage 9: Documentation and wrap-up (Opus)

1. `dev-qual/scripts/check.sh --comprehensive` passes: all suites, plus `npm audit --audit-level=high`.
2. `dev-qual/scripts/stale-docs.sh --base main`, then the `docs-review` skill. Update `README.md`, `docs/dev-overview.md` (scripts, layout, Node version), `docs/code-formatting.md` (baseline adoption, new scripts) and `GEMINI.md`.
3. Outstanding-work review (`dev-qual/guidance/process/after-coding.md` §3–4). Record anything deferred in `docs/outstanding-issues.md` with its condition (likely TS 7, the tfjs transitive vulns, and the PR check workflow), and mirror it to memory.
4. Set `status: done`, then push the branch (with the user's go-ahead) and open a PR.

## Verification

- `dev-qual/scripts/check.sh --comprehensive` is all PASS from the repo root, with stacks showing `node`.
- `npm outdated` lists only items recorded in `docs/outstanding-issues.md`. `npm audit --audit-level=high` exits 0.
- `npm run dev`: the landing page, `/game/test-game` and `/game/magic-trifle` load, and a challenge can be solved by mouse and by keyboard.
- `npm run build:gh-pages` produces `dist/` with the `/2025-xmas-game/` base. The deploy workflow passes on the PR branch via `workflow_dispatch`, or after merge.
- A trivial commit on the branch passes the pre-commit hook without `--no-verify`.
