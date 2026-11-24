import type { Page } from "@playwright/test";
import type { UnzippedRecording } from "../../src/debug/Replay";

export { readRecording, type UnzippedRecording } from "../../src/debug/Replay";

/**
 * Plays a recording's video in the page, reading a strip of pixels from every frame as it plays. The video from
 * `MediaRecorder` has no seek index, so frames are read in order rather than by seeking.
 * @param strip the rows to read from the top of each frame, in pixels
 * @returns each frame's time in the video, in milliseconds, and the red channel of the strip's pixels, row by row
 */
export const playVideoFrames = async (
  page: Page,
  { recording, files }: UnzippedRecording,
  strip: number,
): Promise<{ mediaMs: number; width: number; red: number[] }[]> =>
  page.evaluate(
    async ({ bytes, type, rows }) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      const frames: { mediaMs: number; width: number; red: number[] }[] = [];
      await new Promise<void>((resolve, reject) => {
        const read: VideoFrameRequestCallback = (_, { mediaTime }) => {
          canvas.width = video.videoWidth;
          canvas.height = rows;
          context.drawImage(video, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, rows);
          frames.push({ mediaMs: mediaTime * 1000, width: canvas.width, red: [...data].filter((_, i) => i % 4 === 0) });
          video.requestVideoFrameCallback(read);
        };
        video.requestVideoFrameCallback(read);
        video.onended = () => resolve();
        video.onerror = () => reject(new Error("the recording's video could not be played"));
        void video.play();
      });
      return frames;
    },
    { bytes: [...files[recording.video]], type: recording.videoType, rows: strip },
  );
