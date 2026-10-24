import { readFile } from "node:fs/promises";
import { Ajv, type AnySchema } from "ajv";

/**
 * Validates a JSON file against a JSON schema, listing every error.
 *
 * Replaces the unmaintained ajv-cli with the ajv library it wrapped, so the version is pinned in the
 * lockfile and covered by `npm audit`.
 */
const USAGE = "Usage: node scripts/validate-schema.ts <schema.json> <data.json>";

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

/** Whether a parsed value can be a JSON schema: an object, or `true`/`false`. */
const isSchema = (value: unknown): value is AnySchema =>
  typeof value === "boolean" || (typeof value === "object" && value !== null && !Array.isArray(value));

async function main(): Promise<number> {
  const [schemaFile, dataFile] = process.argv.slice(2);
  if (!schemaFile || !dataFile) throw new Error("a schema and a data file are both needed");

  const schema = await readJson(schemaFile);
  if (!isSchema(schema)) throw new Error(`${schemaFile} is not a JSON schema`);

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  if (validate(await readJson(dataFile))) {
    console.log(`${dataFile} valid`);
    return 0;
  }
  console.error(`${dataFile} invalid:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  return 1;
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
