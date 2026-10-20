/** Media played with a display. Resources are names defined in the game's `resources`. */
export interface GameDisplayMediaData {
  /** The kind of media: only audio is supported. */
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
