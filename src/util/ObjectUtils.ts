import type { GameSource } from "../entities/GameSource";

/** Type guard: true unless the value is undefined or null. */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/** Type guard: true if the string is present and contains something other than whitespace. */
export function isDefinedAndHasContent(value: string | undefined | null): value is string {
  return !isUndefinedOrWhitespaceOrEmpty(value);
}

/** True if the value is missing, empty, or only whitespace. */
export function isUndefinedOrWhitespaceOrEmpty(value: string | undefined | null): boolean {
  return value === undefined || value === null || isWhitespaceOrEmpty(value);
}

/** True if the string is empty or only whitespace. */
export function isWhitespaceOrEmpty(value: string): boolean {
  return value.trim().length === 0;
}

/** Type guard: true if the value is a valid absolute http or https URL. */
export function isUrl(value: string | undefined | null): value is string {
  if (isDefinedAndHasContent(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

/** The directory containing a file URL, for resolving paths beside it. */
export function getDirectoryURL(fileURL: URL): URL {
  return new URL("./", fileURL);
}

/** This site's base URL, including any deployment sub-path. */
export function getBaseURL(): URL {
  return new URL(import.meta.env.BASE_URL, window.location.origin);
}

/**
 * Resolves a target relative to where the repository lives: the repository's own directory
 * for a remote one, or the site for a local one.
 * @param kind what the target is, for the error message (e.g. "template sources")
 * @throws for a raw repository, which has no location to resolve against
 */
export function resolveRelativeURL(target: string, repositorySource: GameSource, kind: string): string {
  switch (repositorySource.type) {
    case "RemoteRepository":
      return new URL(target, getDirectoryURL(repositorySource.src)).toString();
    case "LocalRepository":
      return new URL(target, getBaseURL()).toString();
    case "RawRepository":
      throw new Error(`Raw repository does not support relative ${kind}`);
  }
}
