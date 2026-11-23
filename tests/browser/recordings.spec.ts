import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { MODEL_TIMEOUT, openCameraGame } from "./fixtures/cameraGame";
import { TIME_CODE } from "./fixtures/fakeCamera";
import { peoplePhotoUrls } from "./fixtures/people/people";
import { playVideoFrames, readRecording } from "./recordings";

/** How long the test records for, in milliseconds. */
const RECORD_MS = 3000;

/** How long the fake camera shows each frame, in milliseconds. */
const FRAME_MS = 1000 / 30;

/** The time a frame's time code says it was painted, in milliseconds, wrapped as the code wraps. */
const paintedAt = (red: number[], width: number): number => {
  const { bits, stepMs, height } = TIME_CODE;
  const row = Math.floor(height / 2) * width;
  const code = Array.from({ length: bits }, (_, bit) => red[row + Math.floor(((bit + 0.5) * width) / bits)] > 128);
  return code.reduce((value, on) => value * 2 + (on ? 1 : 0), 0) * stepMs;
};

declare global {
  interface Window {
    /** Each frame given to the model: when, and its time code's top strip, as {@link watchModelInput} reads it. */
    __modelInputs: { at: number; width: number; red: number[] }[];
  }
}

/**
 * Reads the time code of every frame the page gives the model, by wrapping `createImageBitmap`, which the tracking
 * loop calls with the video as it takes each frame.
 */
const watchModelInput = (page: Page) =>
  page.addInitScript((rows) => {
    const original = window.createImageBitmap.bind(window);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    window.__modelInputs = [];
    window.createImageBitmap = ((source: ImageBitmapSource, ...rest: [ImageBitmapOptions?]) => {
      if (source instanceof HTMLVideoElement) {
        [canvas.width, canvas.height] = [source.videoWidth, rows];
        context.drawImage(source, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, rows);
        const red = [...data].filter((_, i) => i % 4 === 0);
        window.__modelInputs.push({ at: performance.now(), width: canvas.width, red });
      }
      return original(source, ...rest);
    }) as typeof window.createImageBitmap;
  }, TIME_CODE.height);

/** The item whose key is nearest to the value. */
const nearest = <T>(items: T[], key: (item: T) => number, value: number): T =>
  items.reduce((a, b) => (Math.abs(key(b) - value) < Math.abs(key(a) - value) ? b : a));

test("records the camera with each frame's masks and players, timed to the video", async ({ page }, testInfo) => {
  test.setTimeout(MODEL_TIMEOUT + 60_000);
  await watchModelInput(page);
  await openCameraGame(page, { query: "?debug=true", photos: peoplePhotoUrls(), timeCode: true });
  await page.evaluate(() => window.__fakeCamera.setImage("photo:jumping-side-on"));
  await expect.poll(() => page.evaluate(() => window.__cameraDraws), { timeout: MODEL_TIMEOUT }).toBeGreaterThan(2);

  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText(/● Recording \d/)).toBeVisible();
  await page.waitForTimeout(RECORD_MS);
  await page.getByRole("button", { name: "Stop" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const unzipped = readRecording(new Uint8Array(await readFile(await (await download).path())));
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0);

  // Every frame has a mask for each person found, the size of the frame, and the tracked player
  const { recording, files } = unzipped;
  expect(recording.frames.length).toBeGreaterThan(5);
  expect(recording.camera).toMatchObject({ label: expect.any(String), width: 640, height: 480 });
  const found = recording.frames.filter(({ detected }) => detected.length > 0);
  expect(found.length).toBeGreaterThan(recording.frames.length / 2);
  for (const { detected, width, height } of found)
    for (const { mask } of detected) expect(files[mask]).toHaveLength(width * height);
  expect(found.some(({ players }) => players.length > 0)).toBe(true);
  // Each tracked player has a game state, and the recording says which scenes it was made in
  expect(found.some(({ players, states }) => players.some(({ id }) => states[id] === "active"))).toBe(true);
  expect(recording.scenes[0]).toMatchObject({ fromMs: 0, game: expect.any(String), scenes: expect.any(String) });

  // The video frame at each recorded frame's time shows the picture the model was given, almost always to within a
  // frame
  const videoFrames = await playVideoFrames(page, unzipped, TIME_CODE.height);
  const modelInputs = await page.evaluate(() => window.__modelInputs);
  const errors = recording.frames.map(({ videoMs, timestamp }) => {
    const shown = nearest(videoFrames, ({ mediaMs }) => mediaMs, videoMs);
    const given = nearest(modelInputs, ({ at }) => at, timestamp);
    return paintedAt(shown.red, shown.width) - paintedAt(given.red, given.width);
  });
  testInfo.annotations.push({ type: "timing", description: `${errors.length} frames, errors ${errors.join(" ")} ms` });
  // A loaded machine can delay the odd frame, so only the share is checked; the late start event failed it
  const withinAFrame = errors.filter((error) => Math.abs(error) <= FRAME_MS * 1.5);
  expect(withinAFrame.length).toBeGreaterThanOrEqual(errors.length * 0.9);
});
