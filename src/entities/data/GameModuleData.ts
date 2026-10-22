/** Base settings for an optional game module. */
export interface GameModuleData {
  /** Whether the module is switched on for this game. */
  enabled: boolean;
}

/** Settings for the camera module, which layers the player's camera view into the game. */
export interface CameraModuleData extends GameModuleData {
  /** Whether the webcam preview shows. Defaults to `true`. */
  preview?: boolean;
}
