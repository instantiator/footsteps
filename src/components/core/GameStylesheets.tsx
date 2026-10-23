import { isDefined } from "../../util/ObjectUtils";
import { useGameData } from "../../providers/GameDataHook";

/** Whether a stylesheet URL is safe to load: `https:`, or on this site. */
function isAllowedStylesheet(href: string): boolean {
  const url = new URL(href, location.href);
  return url.protocol === "https:" || url.origin === location.origin;
}

/** Loads the stylesheets the game names, skipping (with a warning) any that are missing or not allowed. */
export default function GameStylesheets() {
  const { gameData, resources } = useGameData();
  return (gameData.stylesheets ?? []).flatMap((key) => {
    const href = resources[key];
    if (!isDefined(href) || !isAllowedStylesheet(href)) {
      console.warn(`Skipping stylesheet "${key}": ${href ?? "no such resource"}`);
      return [];
    }
    return <link key={key} rel="stylesheet" href={href} precedence="game" />;
  });
}
