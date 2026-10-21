import type { GameResourceDefinitions } from "../entities/data/GameData";
import type { GameSource } from "../entities/GameSource";
import { getBaseURL, resolveRelativeURL } from "./ObjectUtils";

/** Resolves each of a game's resource definitions to an absolute URL. */
export const resolveResources = (
  definitions: GameResourceDefinitions | undefined,
  repositorySource: GameSource,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(definitions ?? {}).map(([key, def]) => {
      switch (def.type) {
        case "local":
          return [key, new URL(def.target, getBaseURL()).toString()];
        case "relative":
          return [key, resolveRelativeURL(def.target, repositorySource, "resource targets")];
        case "url":
          return [key, new URL(def.target).toString()]; // simple urls can be used directly
      }
    }),
  );
