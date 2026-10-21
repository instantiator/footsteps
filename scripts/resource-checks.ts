import { isAbsolute, relative, resolve, sep } from "node:path";
import type { GameData } from "../src/entities/data/GameData";
import type { GameDisplayBase } from "../src/entities/data/displays/GameDisplayData";
import type { GameDisplayTemplateSourceData } from "../src/entities/data/displays/GameDisplayTemplateComponentData";
import type { GameRepository } from "../src/entities/GameRepository";

/** True unless the value is undefined or null. */
const isDefined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;

/** True if the string is present and not only whitespace. */
const hasContent = (value: string | undefined): value is string => isDefined(value) && value.trim() !== "";

/** One reference that failed its check, located by its path in the source JSON. */
export interface ResourceProblem {
  /** Path to the failing field, e.g. `games.magic-trifle.resources.star.target`. */
  path: string;
  /** What went wrong, including the resolved file path or URL. */
  message: string;
}

/** How many references of each kind the checks examined. */
export interface CheckCounts {
  files: number;
  urls: number;
  names: number;
}

/** The outcome of checking one game or a whole repository. */
export interface CheckResult {
  problems: ResourceProblem[];
  checked: CheckCounts;
}

/** Answers whether a resolved path is a readable file. */
export type FileExists = (path: string) => Promise<boolean>;

/** The parts of a response the URL check needs. */
export interface UrlResponse {
  ok: boolean;
  status: number;
  statusText: string;
}

/** Requests a URL, rejecting when it cannot be reached. */
export type UrlRequest = (url: string) => Promise<UrlResponse>;

/** Everything the checks need, injected so the logic can be tested without disk or network. */
export interface CheckOptions {
  /** Directory that `local` targets resolve against. */
  siteRoot: string;
  /** Directory that `relative` targets resolve against: the repository's own directory. */
  repositoryRoot: string;
  /** Check only that URLs are well formed, without requesting them. */
  skipUrls: boolean;
  fileExists: FileExists;
  request: UrlRequest;
}

/** A target resolved to a path on disk, or the reason it cannot be. */
export type ResolvedTarget = { path: string } | { problem: string };

/**
 * Resolves a `local` or `relative` target to a path inside the root it belongs to,
 * rejecting anything that would read outside that root.
 */
export function resolveTargetOnDisk(
  kind: "local" | "relative",
  target: string,
  roots: { siteRoot: string; repositoryRoot: string },
): ResolvedTarget {
  const rootName = kind === "local" ? "site" : "repository";
  const root = resolve(kind === "local" ? roots.siteRoot : roots.repositoryRoot);
  if (target.trim() === "") return { problem: "target is empty" };
  if (isAbsolute(target)) return { problem: `target must be relative to the ${rootName} root: ${target}` };
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return { problem: `target is a URL, so use type "url": ${target}` };

  const path = resolve(root, target);
  const inside = relative(root, path);
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return { problem: `target resolves outside the ${rootName} root: ${target}` };
  }
  return { path };
}

/** A file or URL target declared in the data. */
interface TargetReference {
  /** Path within the game, e.g. `resources.star.target`. */
  path: string;
  kind: "local" | "relative" | "url";
  target: string;
}

/** A resource name referred to by the data, to be found in the game's `resources`. */
interface NameReference {
  path: string;
  name: string;
}

/** Everything collected from one game, with paths relative to the game. */
interface GameReferences {
  targets: TargetReference[];
  names: NameReference[];
  problems: ResourceProblem[];
}

/** Visits every display in the game with its path relative to the game. */
function eachDisplay(game: GameData, visit: (display: GameDisplayBase, path: string) => void): void {
  game.displays.forEach((display, index) => visit(display, `displays[${index}]`));
  game.stages.forEach((stage, stageIndex) => {
    stage.displays?.forEach((display, index) => visit(display, `stages[${stageIndex}].displays[${index}]`));
    stage.challenges.forEach((challenge, challengeIndex) => {
      challenge.displays.forEach((display, index) =>
        visit(display, `stages[${stageIndex}].challenges[${challengeIndex}].displays[${index}]`),
      );
    });
  });
}

/** Collects every resource path, template source and resource name a game refers to. */
function collectReferences(game: GameData): GameReferences {
  const targets: TargetReference[] = [];
  const names: NameReference[] = [];
  const problems: ResourceProblem[] = [];

  Object.entries(game.resources ?? {}).forEach(([name, definition]) => {
    targets.push({ path: `resources.${name}.target`, kind: definition.type, target: definition.target });
  });

  game.stylesheets?.forEach((name, index) => names.push({ path: `stylesheets[${index}]`, name }));

  if (isDefined(game.tileGraphic)) names.push({ path: "tileGraphic", name: game.tileGraphic });

  const sounds = game.sounds;
  if (isDefined(sounds)) {
    const soundFields = [
      "openingMusicResource",
      "closingMusicResource",
      "stageOpenedSoundResource",
      "stageCompletedSoundResource",
    ] as const;
    soundFields.forEach((field) => {
      const name = sounds[field];
      if (isDefined(name)) names.push({ path: `sounds.${field}`, name });
    });
  }

  eachDisplay(game, (display, displayPath) => {
    const { component } = display;
    const componentPath = `${displayPath}.component`;

    const addTemplate = (template: GameDisplayTemplateSourceData | undefined, path: string) => {
      if (!isDefined(template) || template.sourceType === "embedded") return;
      if (!hasContent(template.templateSource)) {
        problems.push({ path: `${path}.templateSource`, message: "templateSource is missing" });
        return;
      }
      targets.push({ path: `${path}.templateSource`, kind: template.sourceType, target: template.templateSource });
    };

    addTemplate(component.backgroundTemplate, `${componentPath}.backgroundTemplate`);
    addTemplate(component.foregroundTemplate, `${componentPath}.foregroundTemplate`);

    if (component.type === "dialog" && isDefined(component.imageResource)) {
      names.push({ path: `${componentPath}.imageResource`, name: component.imageResource });
    }

    if (component.type === "template") return;
    component.contents.forEach((page, index) => {
      const media = page.media;
      if (!isDefined(media)) return;
      const mediaPath = `${componentPath}.contents[${index}].media`;
      names.push({ path: `${mediaPath}.resource`, name: media.resource });
      if (isDefined(media.stillImageResource)) {
        names.push({ path: `${mediaPath}.stillImageResource`, name: media.stillImageResource });
      }
      if (isDefined(media.motionImageResource)) {
        names.push({ path: `${mediaPath}.motionImageResource`, name: media.motionImageResource });
      }
    });
  });

  return { targets, names, problems };
}

/** Why a URL target can't be requested, or undefined when it is a usable http(s) URL. */
function urlProblem(target: string): string | undefined {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return `target is not an absolute URL: ${target}`;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `target must use http or https: ${target}`;
  }
  return undefined;
}

/** Joins a JSON path prefix with a path within it. */
const at = (prefix: string, path: string): string => (prefix === "" ? path : `${prefix}.${path}`);

/** Builds a check function that shares file and URL results, so each is only examined once. */
function createChecker(options: CheckOptions) {
  const fileProblems = new Map<string, string | undefined>();
  const urlProblems = new Map<string, string | undefined>();

  const checkFile = async (kind: "local" | "relative", target: string): Promise<string | undefined> => {
    const resolved = resolveTargetOnDisk(kind, target, options);
    if ("problem" in resolved) return resolved.problem;
    if (!fileProblems.has(resolved.path)) {
      const exists = await options.fileExists(resolved.path);
      fileProblems.set(resolved.path, exists ? undefined : `file not found: ${resolved.path}`);
    }
    return fileProblems.get(resolved.path);
  };

  const requestProblem = async (target: string): Promise<string | undefined> => {
    try {
      const response = await options.request(target);
      if (response.ok) return undefined;
      const statusText = hasContent(response.statusText) ? ` ${response.statusText}` : "";
      return `${target} returned ${response.status}${statusText}`;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `${target} could not be reached: ${reason}`;
    }
  };

  const checkUrl = async (target: string): Promise<string | undefined> => {
    const invalid = urlProblem(target);
    if (isDefined(invalid) || options.skipUrls) return invalid;
    if (!urlProblems.has(target)) {
      urlProblems.set(target, await requestProblem(target));
    }
    return urlProblems.get(target);
  };

  const checkOne = async (game: GameData, prefix: string): Promise<CheckResult> => {
    const { targets, names, problems } = collectReferences(game);
    const checked: CheckCounts = { files: 0, urls: 0, names: 0 };
    const definitions = game.resources ?? {};
    const found = problems.map((problem) => ({ ...problem, path: at(prefix, problem.path) }));

    for (const reference of targets) {
      if (reference.kind === "url") {
        checked.urls += 1;
        const problem = await checkUrl(reference.target);
        if (isDefined(problem)) found.push({ path: at(prefix, reference.path), message: problem });
      } else {
        checked.files += 1;
        const problem = await checkFile(reference.kind, reference.target);
        if (isDefined(problem)) found.push({ path: at(prefix, reference.path), message: problem });
      }
    }

    for (const reference of names) {
      checked.names += 1;
      if (!Object.hasOwn(definitions, reference.name)) {
        found.push({ path: at(prefix, reference.path), message: `refers to undefined resource "${reference.name}"` });
      }
    }

    return { problems: found, checked };
  };

  return checkOne;
}

/** Checks one game's resource paths, template sources and resource names. */
export async function checkGame(game: GameData, options: CheckOptions): Promise<CheckResult> {
  return createChecker(options)(game, "");
}

/** Checks every game in a repository, prefixing each path with its game id. */
export async function checkRepository(repository: GameRepository, options: CheckOptions): Promise<CheckResult> {
  const checkOne = createChecker(options);
  const result: CheckResult = { problems: [], checked: { files: 0, urls: 0, names: 0 } };

  for (const [id, game] of Object.entries(repository.games)) {
    const gameResult = await checkOne(game, `games.${id}`);
    result.problems.push(...gameResult.problems);
    result.checked.files += gameResult.checked.files;
    result.checked.urls += gameResult.checked.urls;
    result.checked.names += gameResult.checked.names;
  }

  return result;
}
