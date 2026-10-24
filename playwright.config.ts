import { defineConfig, devices } from "@playwright/test";

/** A port of its own, so the suite never picks up (or fights with) a developer's dev server. */
const PORT = 5180;

/**
 * Browser tests run the real camera pipeline in Chromium, against a fake webcam feed.
 *
 * They need the Chromium browser (`npx playwright install chromium`) and, on the first run,
 * network access to download the TensorFlow body-segmentation model (about 90 MB).
 */
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    launchOptions: {
      args: [
        // The preview plays a stream without audio; let it start without a user gesture
        "--autoplay-policy=no-user-gesture-required",
        // Headless Chromium defaults to software WebGL; Metal makes segmentation fast enough to test
        // ...and WebGPU is off unless enabled, which the vision benchmark compares against WebGL
        ...(process.platform === "darwin" ? ["--use-angle=metal", "--enable-unsafe-webgpu"] : []),
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
