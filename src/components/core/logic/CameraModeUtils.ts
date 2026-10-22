import type { GameData } from "../../../entities/data/GameData";
import { isDefined } from "../../../util/ObjectUtils";
import type { LayeredGameDisplayRenderData } from "./RenderDataUtils";

/** Whether camera mode and its preview are on for the displays currently shown. */
export interface ResolvedCameraMode {
  /** Whether camera mode is on. */
  enabled: boolean;
  /** Whether the webcam preview shows. */
  preview: boolean;
}

/** A camera setting that can be resolved by inheritance. */
type CameraModeField = keyof ResolvedCameraMode;

/** Anything that can declare camera settings: a display or the game's module. */
type CameraModeSource = Partial<Record<CameraModeField, boolean>>;

/** The value a setting takes when nothing sets it. */
const CAMERA_MODE_DEFAULTS: ResolvedCameraMode = { enabled: false, preview: true };

/** The active challenges' values for one field, in display order. */
const challengeValues = (field: CameraModeField, renderData: LayeredGameDisplayRenderData): boolean[] =>
  (renderData.challengesRenderData ?? []).map((challenge) => challenge.camera?.[field]).filter(isDefined);

/** The first value the given sources declare for the field, if any. */
const firstDeclared = (field: CameraModeField, ...sources: (CameraModeSource | undefined)[]): boolean | undefined => {
  for (const source of sources) {
    const value = source?.[field];
    if (isDefined(value)) return value;
  }
  return undefined;
};

/**
 * Resolves one camera setting by inheritance, most specific first.
 *
 * 1. Any active challenge setting it to `true` wins.
 * 2. Otherwise, any active challenge setting it to `false` wins.
 * 3. Otherwise, the stage display's value.
 * 4. Otherwise, the overview display's value.
 * 5. Otherwise, the game's camera module.
 * 6. Otherwise, the default.
 */
const resolveCameraField = (
  field: CameraModeField,
  gameData: GameData,
  renderData: LayeredGameDisplayRenderData,
): boolean => {
  const values = challengeValues(field, renderData);
  if (values.includes(true)) return true;
  if (values.includes(false)) return false;

  return (
    firstDeclared(field, renderData.stageRenderData?.camera, renderData.overviewRenderData?.camera) ??
    firstDeclared(field, gameData.modules?.camera) ??
    CAMERA_MODE_DEFAULTS[field]
  );
};

/**
 * Resolves camera mode and its preview by inheritance, most specific first.
 *
 * Any active challenge that enables a setting wins. If none does, an explicit challenge
 * setting disables it. If no challenge declares the setting, the stage, then the overview,
 * then the game's camera module decide.
 *
 * NB. The preview is always off while camera mode is off.
 */
export const resolveCameraMode = (gameData: GameData, renderData: LayeredGameDisplayRenderData): ResolvedCameraMode => {
  const enabled = resolveCameraField("enabled", gameData, renderData);
  return {
    enabled,
    preview: enabled && resolveCameraField("preview", gameData, renderData),
  };
};
