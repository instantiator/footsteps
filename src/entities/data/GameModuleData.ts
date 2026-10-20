/** Base settings for an optional game module. */
export interface GameModuleData {
  /** Whether the module is switched on for this game. */
  enabled: boolean;
}

/** Settings for the camera module, which layers the player's camera view into the game. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CameraModuleData extends GameModuleData {}
