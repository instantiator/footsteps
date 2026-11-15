import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Docs quote real files in code blocks titled with the file's path, in VitePress's title syntax:
 * ```` ```html [public/games/demo-no-camera/lamps.html] ````. A `[git:<rev>:<path>]` title quotes the file as it was
 * at that revision. These tests check every titled block against its file, so a tutorial can't drift from its game.
 */

/** A line standing for a gap in a quote: the file has lines here that the quote leaves out. */
const GAP = /^(…|<!--\s*…\s*-->|\/\/\s*…|\/\*\s*…\s*\*\/)$/;

/** A file's lines with their indentation and blank lines dropped, as quotes are compared. */
const significantLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/**
 * The first line of a quote that isn't in the file where it should be, or undefined if the whole quote is there.
 * Each run of lines between gaps must appear unbroken in the file, and the runs must come in order.
 */
export function missingLine(quote: string, file: string): string | undefined {
  const lines = significantLines(file);
  const chunks = significantLines(quote).reduce<string[][]>(
    (all, line) => (GAP.test(line) ? [...all, []] : [...all.slice(0, -1), [...all[all.length - 1], line]]),
    [[]],
  );
  let from = 0;
  for (const chunk of chunks.filter((run) => run.length > 0)) {
    const at = lines.findIndex(
      (_, index) => index >= from && chunk.every((line, offset) => lines[index + offset] === line),
    );
    if (at < 0) {
      // Name the first line that breaks the run, for a useful failure message
      const start = lines.indexOf(chunk[0], from);
      return start < 0 ? chunk[0] : chunk.find((line, offset) => lines[start + offset] !== line);
    }
    from = at + chunk.length;
  }
  return undefined;
}

/** A titled code block in a doc: what it quotes, and where it starts. */
interface Quote {
  doc: string;
  line: number;
  source: string;
  text: string;
}

/** Every titled code block in a Markdown file. */
const quotesIn = (doc: string): Quote[] => {
  const quotes: Quote[] = [];
  let open: { fence: string; source?: string; line: number; lines: string[] } | undefined;
  readFileSync(doc, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
      if (open === undefined && fence) {
        open = { fence: fence[1], source: /\[([^\]]+)\]/.exec(fence[2])?.[1], line: index + 1, lines: [] };
      } else if (open !== undefined && line.trim() === open.fence) {
        if (open.source !== undefined) {
          quotes.push({ doc, line: open.line, source: open.source, text: open.lines.join("\n") });
        }
        open = undefined;
      } else open?.lines.push(line);
    });
  return quotes;
};

/** The text a quote's title names: a file in the repository, or a file at a git revision. */
const sourceText = (source: string): string => {
  const revision = /^git:([^:]+):(.+)$/.exec(source);
  if (revision) return execFileSync("git", ["show", `${revision[1]}:${revision[2]}`], { encoding: "utf8" });
  return readFileSync(source, "utf8");
};

/** The docs that may quote files: everything but the prompts and plans, which describe work rather than quote it. */
const docs = readdirSync("docs", { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".md") && !path.startsWith("prompts"))
  .map((path) => join("docs", path));

describe("missingLine", () => {
  const file = "<div>\n  <p>one</p>\n  <p>two</p>\n</div>\n<span>three</span>\n";

  it("finds nothing missing from an exact quote", () => {
    expect(missingLine(file, file)).toBeUndefined();
  });

  it("allows a gap between two runs", () => {
    expect(missingLine("<div>\n…\n<span>three</span>", file)).toBeUndefined();
  });

  it("ignores indentation", () => {
    expect(missingLine("<p>one</p>\n      <p>two</p>", file)).toBeUndefined();
  });

  it("rejects runs out of order", () => {
    expect(missingLine("<span>three</span>\n…\n<div>", file)).toBe("<div>");
  });

  it("names a changed line", () => {
    expect(missingLine("<p>one</p>\n<p>TWO</p>", file)).toBe("<p>TWO</p>");
  });

  it("rejects a run with a line missing from its middle", () => {
    expect(missingLine("<div>\n<p>two</p>", file)).toBe("<p>two</p>");
  });
});

describe("quotes in the docs", () => {
  const quotes = docs.flatMap(quotesIn);

  it.each(quotes.map((quote) => [`${quote.doc}:${quote.line} quotes ${quote.source}`, quote] as const))(
    "%s",
    (_, quote) => {
      expect(missingLine(quote.text, sourceText(quote.source))).toBeUndefined();
    },
  );

  it("finds the docs to check", () => {
    expect(docs).toContain(join("docs", "game-data.md"));
  });
});
