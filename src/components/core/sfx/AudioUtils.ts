export const playAudio = async (res: string): Promise<{ resource: string; audio: HTMLAudioElement } | undefined> => {
  try {
    const audio = new Audio(res);
    await audio.play();
    return { resource: res, audio };
  } catch (err) {
    console.error("Error playing audio:", err);
    return undefined;
  }
};
