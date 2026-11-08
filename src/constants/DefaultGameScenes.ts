import type { GameSceneTemplateSourceData } from "../entities/data/scenes/GameSceneTemplateComponentData";

/** Fallback template shown when a scene has no template of its own. */
export const NO_TEMPLATE: GameSceneTemplateSourceData = {
  sourceType: "embedded",
  content: "<h1>No template found</h1>",
};
