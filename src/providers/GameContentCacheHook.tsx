import { useContext } from "react";
import type { GameDisplayTemplateSourceData } from "../entities/data/displays/GameDisplayTemplateComponentData";
import type { GameSource } from "../entities/GameSource";
import { getBaseURL, isDefined, resolveRelativeURL } from "../util/ObjectUtils";
import { GameContentCacheContext } from "./GameContentCacheContext";
import { GameRepositoryContext } from "./GameRepositoryContext";

/**
 * Resolves a "local" or "relative" template source to an absolute URL for the given repository:
 * local sources resolve against the site, relative ones against the repository's own location.
 * @throws if the repository type can't host that kind of source
 */
export const resolveTemplateURL = (
  sourceType: "local" | "relative",
  templateSource: string,
  repositorySource: GameSource,
): string => {
  if (sourceType === "relative") return resolveRelativeURL(templateSource, repositorySource, "template sources");
  switch (repositorySource.type) {
    case "LocalRepository":
      return new URL(templateSource, getBaseURL()).toString();
    case "RemoteRepository":
      throw new Error("Remote repository does not support local template sources");
    case "RawRepository":
      throw new Error("Raw repository does not support local template sources");
  }
};

/** Loads display templates, caching any fetched from a URL. */
export default function useContentCache() {
  const { source: repositorySource } = useContext(GameRepositoryContext);
  const { cache, setCache } = useContext(GameContentCacheContext);

  const fetchTemplate = async (template: GameDisplayTemplateSourceData): Promise<GameDisplayTemplateSourceData> => {
    const response = await fetch(template.templateSource!);
    const text = await response.text();
    setCache((previous) => ({ ...previous, templates: [...previous.templates, { ...template, content: text }] }));
    return { ...template, content: text };
  };

  const getTemplate = async (
    template: GameDisplayTemplateSourceData | undefined,
  ): Promise<GameDisplayTemplateSourceData | undefined> => {
    if (!isDefined(template)) return undefined;
    if (template.sourceType === "embedded") {
      return template;
    }

    const cached = cache.templates.find(
      (t) => t.sourceType === template.sourceType && t.templateSource === template.templateSource,
    );
    if (isDefined(cached)) return cached;

    if (template.sourceType === "url") return fetchTemplate(template);

    return getTemplate({
      ...template,
      sourceType: "url",
      templateSource: resolveTemplateURL(template.sourceType, template.templateSource!, repositorySource),
    });
  };

  return {
    /** Gets a template with its content: embedded as-is, otherwise from the cache or fetched. */
    getTemplate,
  };
}
