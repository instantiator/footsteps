import type { GameSpawnAction } from "../../../entities/data/scenes/GameSceneData";
import type { SceneScope } from "../../../entities/state/GameState";
import { sceneRoots } from "../logic/TemplateUtils";

/** Marks a spawned copy, so template re-renders keep it and `despawn` may remove it. */
export const SPAWNED_ATTRIBUTE = "data-spawned";

/** Most copies a scene may hold at once, so a fast spawn with no despawn can't flood it. */
export const MAX_SPAWNED = 100;

/** Counts copies, for the ids of those whose markup gives none. */
let copies = 0;

/**
 * The scene runs that have hit {@link MAX_SPAWNED}, so each logs once.
 * ponytail: grows by one key per run that floods, which is a mistake to fix, not a steady state.
 */
const flooded = new Set<string>();

/** The first element matching a selector in a scene's templates. */
const findIn = (scope: SceneScope, selector: string): Element | undefined =>
  sceneRoots(scope)
    .map((root) => root.querySelector(selector))
    .find((element) => element !== null) ?? undefined;

/** How many copies a scene holds. */
const countSpawned = (scope: SceneScope): number =>
  sceneRoots(scope).reduce((count, root) => count + root.querySelectorAll(`[${SPAWNED_ATTRIBUTE}]`).length, 0);

/**
 * Adds a copy of a template's first element to the element `into` names, in a scene, with an id if it has none.
 * @param at the scene's run, and where the action is in the rules, for messages
 * @returns the copy, or undefined (after logging) if the template or `into` is missing, or the scene is full
 */
export const spawn = (
  scope: SceneScope,
  { spawn: selector, into }: Pick<GameSpawnAction, "spawn" | "into">,
  { run, where }: { run: number; where: string },
): Element | undefined => {
  const template = findIn(scope, selector);
  const parent = findIn(scope, into);
  if (!(template instanceof HTMLTemplateElement)) {
    console.warn(`${where}.spawn: "${selector}" matches no <template> in the scene`);
    return undefined;
  }
  if (parent === undefined) {
    console.warn(`${where}.into: "${into}" matches nothing in the scene`);
    return undefined;
  }
  if (countSpawned(scope) >= MAX_SPAWNED) {
    if (!flooded.has(`${scope}#${run}`))
      console.error(`${where}: not spawned, as the scene holds ${MAX_SPAWNED} copies`);
    flooded.add(`${scope}#${run}`);
    return undefined;
  }
  const [first, ...others] = Array.from(template.content.children);
  if (others.length > 0) console.warn(`${where}.spawn: "${selector}" has more than one element; only the first spawns`);
  if (first === undefined) {
    console.warn(`${where}.spawn: "${selector}" is empty`);
    return undefined;
  }
  const copy = document.importNode(first, true);
  if (copy.id === "") copy.id = `${template.id || "spawn"}-${++copies}`;
  copy.setAttribute(SPAWNED_ATTRIBUTE, "");
  parent.append(copy);
  return copy;
};

/** Removes the spawned copies a selector matches in a scene, leaving any element that wasn't spawned. */
export const despawn = (scope: SceneScope, selector: string): void => {
  for (const root of sceneRoots(scope)) {
    for (const element of root.querySelectorAll(selector))
      if (element.hasAttribute(SPAWNED_ATTRIBUTE)) element.remove();
  }
};
