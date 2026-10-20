/**
 * Plays a sound effect once, fire and forget.
 * @returns the playing audio, or undefined (after logging) if it could not play, e.g. blocked by the browser.
 */
export const playAudio = async (
  res: string,
): Promise<
  | {
      /** The URL that is playing. */
      resource: string;
      /** The playing element, to pause or listen to. */
      audio: HTMLAudioElement;
    }
  | undefined
> => {
  try {
    const audio = new Audio(res);
    await audio.play();
    return { resource: res, audio };
  } catch (err) {
    console.error("Error playing audio:", err);
    return undefined;
  }
};
