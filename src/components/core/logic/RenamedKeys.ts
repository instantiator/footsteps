/** Game data keys that were renamed, and their new names, named in the error for old game data. */
const RENAMED_KEYS: Record<string, string> = { displays: "scenes", resetDisplay: "resetScene" };

/** Keys whose values belong to the author, so may use any names. */
const AUTHOR_KEYS = new Set(["data", "initialState"]);

/**
 * Finds keys in game or repository data that were renamed, so old data fails naming the new key.
 * Has no imports, so the validation scripts can run it directly.
 * @param value parsed JSON
 * @param path where `value` is, for the messages
 * @returns one message per old key, eg. `stages[0].scenes[1]: "resetDisplay" is now "resetScene"`
 */
export const renamedKeyProblems = (value: unknown, path = ""): string[] => {
  if (Array.isArray(value)) return value.flatMap((item, i) => renamedKeyProblems(item, `${path}[${i}]`));
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const where = path === "" ? key : `${path}.${key}`;
    const renamed = Object.hasOwn(RENAMED_KEYS, key)
      ? [`${path || "game"}: "${key}" is now "${RENAMED_KEYS[key]}"`]
      : [];
    return AUTHOR_KEYS.has(key) ? renamed : [...renamed, ...renamedKeyProblems(child, where)];
  });
};
