import { isAbsolute, relative, resolve, sep } from "node:path";
import type { GameData } from "../src/entities/data/GameData";
import type { GameSceneBase } from "../src/entities/data/scenes/GameSceneData";
import type { GameSceneTemplateSourceData } from "../src/entities/data/scenes/GameSceneTemplateComponentData";
import type { GameRepository } from "../src/entities/GameRepository";
import { FLOOR_AREA_ATTRIBUTE, SURFACE_CLASSES } from "../src/components/core/layout/FloorSurfaceClasses.ts";

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
  /** What is probably a mistake, but doesn't stop the game working. */
  warnings: ResourceProblem[];
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
  /** Reads a file that exists, to check a template's text; without it, only embedded templates are read. */
  readText?: (path: string) => Promise<string>;
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

/** A template whose text is checked: embedded in the data, or in a file. */
interface TemplateReference {
  /** Path within the game, e.g. `scenes[0].component.foregroundTemplate`. */
  path: string;
  /** The template's own text, if embedded. */
  content?: string;
  /** Its file, if not. */
  file?: { kind: "local" | "relative"; target: string };
  /** Whether its scene can ever show in 2.5D, where floor items do something. */
  can25D: boolean;
}

/** Everything collected from one game, with paths relative to the game. */
interface GameReferences {
  targets: TargetReference[];
  names: NameReference[];
  templates: TemplateReference[];
  problems: ResourceProblem[];
}

/** A scene to visit: one of the game's scenes, or a reset scene. */
type VisitedScene = Pick<GameSceneBase, "component" | "resetScene">;

/**
 * Visits every scene in the game, and their reset scenes, with its path relative to the game, and whether it can show
 * in 2.5D. That is the narrowest mode declared for it, of its own, its stage's and the game's. A stage's scene also
 * shows in 2.5D with any challenge that declares it.
 */
function eachScene(game: GameData, visit: (scene: VisitedScene, path: string, can25D: boolean) => void): void {
  const visitWithResets = (scene: VisitedScene, path: string, can25D: boolean): void => {
    visit(scene, path, can25D);
    if (scene.resetScene) visitWithResets(scene.resetScene, `${path}.resetScene`, can25D);
  };
  const mode = game.modules?.scene;
  game.scenes.forEach((scene, index) => visitWithResets(scene, `scenes[${index}]`, (scene.scene ?? mode) === "2.5D"));
  game.stages.forEach((stage, stageIndex) => {
    const stageMode = stage.scenes?.find((scene) => isDefined(scene.scene))?.scene ?? mode;
    const challengeScenes = stage.challenges.flatMap((challenge) => challenge.scenes);
    const any25D = challengeScenes.some((scene) => scene.scene === "2.5D");
    stage.scenes?.forEach((scene, index) =>
      visitWithResets(scene, `stages[${stageIndex}].scenes[${index}]`, (scene.scene ?? mode) === "2.5D" || any25D),
    );
    stage.challenges.forEach((challenge, challengeIndex) => {
      challenge.scenes.forEach((scene, index) =>
        visitWithResets(
          scene,
          `stages[${stageIndex}].challenges[${challengeIndex}].scenes[${index}]`,
          (scene.scene ?? stageMode) === "2.5D",
        ),
      );
    });
  });
}

/** A class attribute naming a floor surface as a whole class name. */
const SURFACE_CLASS = new RegExp(`class\\s*=\\s*["'][^"']*(?<![\\w-])(${SURFACE_CLASSES.join("|")})(?![\\w-])`);

/** What does nothing outside a 2.5D scene: floor items, and floor surfaces. */
const floorOnlyWarnings = (text: string, path: string) => [
  ...(/\bdata-floor-(?!area)/.test(text)
    ? [{ path, message: "data-floor-* does nothing here, as this scene never shows in 2.5D" }]
    : []),
  ...(SURFACE_CLASS.test(text) || text.includes(FLOOR_AREA_ATTRIBUTE) || /\bdata-wall-distance\b/.test(text)
    ? [{ path, message: "floor surfaces do nothing here, as this scene never shows in 2.5D" }]
    : []),
];

/** What a template's text gets wrong: `data-depth`, which has gone, and floor items and surfaces where they do nothing. */
const templateProblems = (text: string, { path, can25D }: TemplateReference) => ({
  problems: /\bdata-depth\b/.test(text)
    ? [{ path, message: "data-depth is no longer supported; give the item data-floor-y (see game-data.md)" }]
    : [],
  warnings: can25D ? [] : floorOnlyWarnings(text, path),
});

/** What a template refers to: its file or URL, the text to check, or what is wrong with it. */
const templateReferences = (
  template: GameSceneTemplateSourceData | undefined,
  path: string,
  can25D: boolean,
): { target?: TargetReference; template?: TemplateReference; problem?: ResourceProblem } => {
  if (!isDefined(template)) return {};
  if (template.sourceType === "embedded") return { template: { path, content: template.content ?? "", can25D } };
  const sourcePath = `${path}.templateSource`;
  if (!hasContent(template.templateSource))
    return { problem: { path: sourcePath, message: "templateSource is missing" } };
  const target = { path: sourcePath, kind: template.sourceType, target: template.templateSource };
  if (template.sourceType === "url") return { target };
  const file = { kind: template.sourceType, target: template.templateSource };
  return { target, template: { path: sourcePath, file, can25D } };
};

/** Collects every resource path, template source and resource name a game refers to. */
function collectReferences(game: GameData): GameReferences {
  const targets: TargetReference[] = [];
  const names: NameReference[] = [];
  const templates: TemplateReference[] = [];
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

  eachScene(game, (scene, scenePath, can25D) => {
    const { component } = scene;
    const componentPath = `${scenePath}.component`;

    const addTemplate = (template: GameSceneTemplateSourceData | undefined, path: string) => {
      const found = templateReferences(template, path, can25D);
      if (found.target) targets.push(found.target);
      if (found.template) templates.push(found.template);
      if (found.problem) problems.push(found.problem);
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

  return { targets, names, templates, problems };
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

/** Checks the templates' text, where it can be read: embedded, or a file that exists. */
async function checkTemplates(
  templates: TemplateReference[],
  prefix: string,
  {
    options,
    checkFile,
  }: { options: CheckOptions; checkFile: (kind: "local" | "relative", target: string) => Promise<string | undefined> },
): Promise<Pick<CheckResult, "problems" | "warnings">> {
  const result: Pick<CheckResult, "problems" | "warnings"> = { problems: [], warnings: [] };
  for (const template of templates) {
    const { content, file } = template;
    let text = content;
    if (isDefined(file) && isDefined(options.readText)) {
      const resolved = resolveTargetOnDisk(file.kind, file.target, options);
      const missing = "problem" in resolved || isDefined(await checkFile(file.kind, file.target));
      if (!missing) text = await options.readText(resolved.path);
    }
    if (!isDefined(text)) continue;
    const found = templateProblems(text, { ...template, path: at(prefix, template.path) });
    result.problems.push(...found.problems);
    result.warnings.push(...found.warnings);
  }
  return result;
}

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
    const { targets, names, templates, problems } = collectReferences(game);
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

    const { problems: textProblems, warnings } = await checkTemplates(templates, prefix, { options, checkFile });
    return { problems: [...found, ...textProblems], warnings, checked };
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
  const result: CheckResult = { problems: [], warnings: [], checked: { files: 0, urls: 0, names: 0 } };

  for (const [id, game] of Object.entries(repository.games)) {
    const gameResult = await checkOne(game, `games.${id}`);
    result.problems.push(...gameResult.problems);
    result.warnings.push(...gameResult.warnings);
    result.checked.files += gameResult.checked.files;
    result.checked.urls += gameResult.checked.urls;
    result.checked.names += gameResult.checked.names;
  }

  return result;
}
