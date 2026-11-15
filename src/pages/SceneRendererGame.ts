import type { GameId } from "../entities/data/GameData";
import type { GameRepository } from "../entities/GameRepository";

/** The renderer's one game. */
export const SCENE_RENDERER_GAME_ID: GameId = "scene-renderer";

/** What the renderer shows before anything is pasted: the floor, and one item standing on it. */
export const STARTER_SCENE = `<div class="floor-background" style="background: repeating-conic-gradient(#8a6 0 25%, #7a5 0 50%) 0 0 / calc(var(--floor-unit) * 20) calc(var(--floor-unit) * 20);"></div>

<div id="tree" data-floor-x="50" data-floor-y="50" style="width: 10cqw; height: 25cqh; background: forestgreen; border-radius: 50% 50% 0 0;"></div>
`;

/**
 * A repository of one 2.5D game whose opening scene is the given template, played with the mouse as feet. A game
 * always opens on an overview scene, so the template is the stages overview, and the one stage is never entered.
 */
export const sceneRendererRepository = (html: string): GameRepository => ({
  games: {
    [SCENE_RENDERER_GAME_ID]: {
      title: "Scene renderer",
      description: "A pasted scene, rendered as it would play.",
      modules: { scene: "2.5D", avatar: { mode: "mouse-feet" } },
      scenes: [
        {
          purpose: "game-overview-stages",
          component: {
            type: "template",
            data: {},
            foregroundTemplate: { sourceType: "embedded", content: html },
            foregroundTemplateStyle: { width: "100%", height: "100%" },
          },
        },
      ],
      stages: [
        {
          id: "unused",
          challenges: [
            {
              id: "unused",
              scenes: [{ purpose: "challenge-in-progress", component: { type: "scroll", contents: [], data: {} } }],
              solution: { answers: [] },
            },
          ],
        },
      ],
      gameContainerStyle: {},
    },
  },
});
