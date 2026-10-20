/** Media played with a display. Resources are names defined in the game's `resources`. */
export interface GameDisplayMediaData {
  type: "audio";
  /** Resource name of the audio file. */
  resource: string;
  /** Resource name of an image shown while the audio is not playing. */
  stillImageResource?: string;
  /** Resource name of an image shown while the audio is playing. */
  motionImageResource?: string;
  /** Accessible description of the audio, for screen readers. Default: "audio". */
  audioDescription?: string;
}
