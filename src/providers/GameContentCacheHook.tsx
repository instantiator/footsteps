import { useCallback, useContext } from "react";
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

/** Fetches a template's text, failing on an error response rather than returning the error page. */
const fetchTemplateText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Template ${url}: ${response.status} ${response.statusText}`);
  return response.text();
};

/** Loads display templates, fetching each URL once and sharing the result. */
export default function useContentCache() {
  const { source: repositorySource } = useContext(GameRepositoryContext);
  const { templates } = useContext(GameContentCacheContext);

  const getTemplate = useCallback(
    async (template: GameDisplayTemplateSourceData | undefined): Promise<GameDisplayTemplateSourceData | undefined> => {
      if (!isDefined(template)) return undefined;
      if (template.sourceType === "embedded") return template;

      const url =
        template.sourceType === "url"
          ? template.templateSource!
          : resolveTemplateURL(template.sourceType, template.templateSource!, repositorySource);
      let text = templates.get(url);
      if (!isDefined(text)) {
        text = fetchTemplateText(url);
        templates.set(url, text);
        text.catch(() => templates.delete(url)); // let a later render retry a failed fetch
      }
      return { ...template, content: await text };
    },
    [templates, repositorySource],
  );

  return {
    /** Gets a template with its content: embedded as-is, otherwise fetched once per URL. */
    getTemplate,
  };
}
