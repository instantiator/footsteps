import type { GameSource } from "../entities/GameSource";

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isDefinedAndHasContent(value: string | undefined | null): value is string {
  return !isUndefinedOrWhitespaceOrEmpty(value);
}

export function isUndefinedOrWhitespaceOrEmpty(value: string | undefined | null): boolean {
  return value === undefined || value === null || isWhitespaceOrEmpty(value);
}

export function isWhitespaceOrEmpty(value: string): boolean {
  return value.trim().length === 0;
}

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

export function getDirectoryURL(fileURL: URL): URL {
  return new URL("./", fileURL);
}

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
