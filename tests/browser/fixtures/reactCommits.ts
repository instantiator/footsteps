import type { Page } from "@playwright/test";

declare global {
  interface Window {
    /** How many times React has committed a render to the page. */
    __reactCommits: number;
  }
}

/**
 * Counts React's commits by posing as the React DevTools hook, which React calls after every commit. Installed
 * before the page's scripts run, as React looks for the hook when it loads.
 */
export const installReactCommitCounter = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.__reactCommits = 0;
    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      value: {
        supportsFiber: true,
        renderers: new Map(),
        inject: () => 1,
        checkDCE: () => undefined,
        onScheduleFiberRoot: () => undefined,
        onCommitFiberRoot: () => void window.__reactCommits++,
        onCommitFiberUnmount: () => undefined,
        onPostCommitFiberRoot: () => undefined,
      },
    });
  });
};
