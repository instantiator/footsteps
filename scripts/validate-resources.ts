import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GameData } from "../src/entities/data/GameData";
import type { GameRepository } from "../src/entities/GameRepository";
import {
  checkGame,
  checkRepository,
  type CheckOptions,
  type CheckResult,
  type FileExists,
  type UrlRequest,
} from "./resource-checks.ts";

const USAGE = `Usage:
  node scripts/validate-resources.ts game <game.json> [--site-root <dir>] [--repository-root <dir>] [--skip-urls]
  node scripts/validate-resources.ts repository <repository.json> [--site-root <dir>] [--repository-root <dir>] [--skip-urls]`;

type Mode = "game" | "repository";

interface Args {
  mode: Mode;
  file: string;
  siteRoot: string;
  repositoryRoot: string;
  skipUrls: boolean;
}

/** True when the value names one of the two modes. */
const isMode = (value: string | undefined): value is Mode => value === "game" || value === "repository";

/**
 * Parses the options after the mode and file. `local` targets resolve against the site root;
 * `relative` ones against the repository's own directory, or the site root for a standalone game.
 */
function parseOptions(args: string[], mode: Mode, file: string): Omit<Args, "mode" | "file"> {
  let siteRoot: string | undefined;
  let repositoryRoot: string | undefined;
  let skipUrls = false;

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (option === "--skip-urls") {
      skipUrls = true;
      continue;
    }
    if (option !== "--site-root" && option !== "--repository-root") throw new Error(`unknown option: ${option}`);
    if (value === undefined) throw new Error(`${option} needs a directory`);
    if (option === "--site-root") siteRoot = value;
    else repositoryRoot = value;
    index += 1;
  }

  const resolvedSiteRoot = resolve(siteRoot ?? "public");
  const defaultRepositoryRoot = mode === "repository" ? dirname(resolve(file)) : resolvedSiteRoot;
  return {
    siteRoot: resolvedSiteRoot,
    repositoryRoot: resolve(repositoryRoot ?? defaultRepositoryRoot),
    skipUrls,
  };
}

/** Reads the command line. Throws with a message when it is malformed. */
function parseArgs(argv: string[]): Args {
  const [mode, file, ...rest] = argv;
  if (!isMode(mode)) throw new Error("expected a mode: game or repository");
  if (file === undefined) throw new Error("expected the path to a data file");
  return { mode, file, ...parseOptions(rest, mode, file) };
}

/** Reads and parses a JSON data file. */
async function readJson(file: string): Promise<unknown> {
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`could not parse ${file}: ${reason}`, { cause: error });
  }
}

/**
 * Narrows parsed JSON to a repository. The schema check that runs before this one
 * guarantees the rest of the shape, so only the top-level field is tested here.
 */
const isRepository = (value: unknown): value is GameRepository =>
  typeof value === "object" && value !== null && "games" in value;

/** Narrows parsed JSON to a game, for the same reason as {@link isRepository}. */
const isGame = (value: unknown): value is GameData => typeof value === "object" && value !== null && "stages" in value;

/** True when the path is a readable file. */
const fileExists: FileExists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

/** Requests a URL, stopping the body as soon as the headers arrive. */
const request: UrlRequest = async (url) => {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-0" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  await response.body?.cancel();
  return { ok: response.ok, status: response.status, statusText: response.statusText };
};

/** "1 problem", "2 problems". */
const count = (value: number, noun: string): string => `${value} ${noun}${value === 1 ? "" : "s"}`;

/** Prints every problem, then a summary of what was examined. */
function report(result: CheckResult, options: CheckOptions): void {
  result.problems.forEach((problem) => console.error(`${problem.path}: ${problem.message}`));

  const { files, urls, names } = result.checked;
  const examined = [count(files, "file target"), count(urls, "URL"), count(names, "resource name")].join(", ");
  const skipped = options.skipUrls ? " (URL checks skipped)" : "";
  console.log(`${count(result.problems.length, "problem")} found (examined ${examined})${skipped}.`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const options: CheckOptions = {
    siteRoot: args.siteRoot,
    repositoryRoot: args.repositoryRoot,
    skipUrls: args.skipUrls,
    fileExists,
    request,
  };

  const data = await readJson(args.file);
  const checked =
    args.mode === "repository"
      ? await checkRepository(isData(data, isRepository, args.file), options)
      : await checkGame(isData(data, isGame, args.file), options);

  report(checked, options);
  return checked.problems.length === 0 ? 0 : 1;
}

/** Returns the data narrowed by a guard, or throws saying the file is the wrong kind. */
function isData<T>(value: unknown, guard: (candidate: unknown) => candidate is T, file: string): T {
  if (!guard(value)) throw new Error(`${file} does not hold the expected data; check it against its schema first`);
  return value;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(USAGE);
    process.exitCode = 2;
  });
