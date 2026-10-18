import { useContext } from "react";
import type { GameDisplayTemplateSourceData } from "../entities/data/displays/GameDisplayTemplateComponentData";
import { getBaseURL, getDirectoryURL, isDefined } from "../util/ObjectUtils";
import { GameContentCacheContext } from "./GameContentCacheContext";
import { GameRepositoryContext } from "./GameRepositoryContext";

export default function useContentCache() {
  const { source: repositorySource } = useContext(GameRepositoryContext);
  const { cache, setCache } = useContext(GameContentCacheContext);

  const getTemplate = async (
    template: GameDisplayTemplateSourceData | undefined,
  ): Promise<GameDisplayTemplateSourceData | undefined> => {
    if (!isDefined(template)) {
      return undefined;
    }
    // first check the cache
    const cached =
      template.sourceType !== "embedded"
        ? cache.templates.find(
            (t) => t.sourceType === template.sourceType && t.templateSource === template.templateSource,
          )
        : undefined;

    if (isDefined(cached)) {
      return cached;
    }

    switch (template.sourceType) {
      case "embedded":
        console.debug(`Loaded embedded template.`);
        return template;

      case "local":
        console.debug(`Loading local template: ${template.templateSource}`);
        switch (repositorySource.type) {
          case "RemoteRepository":
            throw "Remote repository does not support local template sources";

          case "LocalRepository":
            return await getTemplate({
              ...template,
              sourceType: "url",
              templateSource: new URL(template.templateSource!, getBaseURL()).toString(),
            });
          case "RawRepository":
            throw "Raw repository does not support local template sources";
        }
        break;

      // convert all "relative" type sources to "url"
      case "relative":
        console.debug(`Loading relative template: ${template.templateSource}`);

        switch (repositorySource.type) {
          case "RemoteRepository":
            return await getTemplate({
              ...template,
              sourceType: "url",
              templateSource: new URL(template.templateSource!, getDirectoryURL(repositorySource.src)).toString(),
            });

          case "LocalRepository":
            return await getTemplate({
              ...template,
              sourceType: "url",
              templateSource: new URL(template.templateSource!, getBaseURL()).toString(),
            });

          case "RawRepository":
            throw "Raw repository does not support relative template sources";
        }
        break;

      case "url": {
        console.debug(`Loading URL template: ${template.templateSource}`);
        const response = await fetch(template.templateSource!);
        const text = await response.text();
        console.debug(`Loaded URL template: ${template.templateSource}`);
        setCache((previous) => ({ ...previous, templates: [...previous.templates, { ...template, content: text }] }));
        return { ...template, content: text };
      }
    }
  };

  return { getTemplate };
}
