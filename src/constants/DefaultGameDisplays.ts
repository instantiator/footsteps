import type { GameDisplayTemplateSourceData } from "../entities/data/displays/GameDisplayTemplateComponentData";

/** Fallback template shown when a display has no template of its own. */
export const NO_TEMPLATE: GameDisplayTemplateSourceData = {
  sourceType: "embedded",
  content: "<h1>No template found</h1>",
};
